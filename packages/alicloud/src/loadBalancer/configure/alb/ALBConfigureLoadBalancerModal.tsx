import type { IQService } from 'angular';
import type { FormikErrors, FormikValues } from 'formik';
import * as React from 'react';

import type { ILoadBalancerModalProps } from '@spinnaker/core';
import {
  LoadBalancerWriter,
  noop,
  ReactInjector,
  ReactModal,
  TaskMonitor,
  WizardModal,
  WizardPage,
} from '@spinnaker/core';

import { ALBListeners } from './ALBListeners';
import { ALBLocation } from './ALBLocation';
// import { ServerGroups } from './ServerGroups';
import { ServerGroups } from './ALBServerGroups';
import { AlicloudLoadBalancerTransformer } from '../../loadBalancer.transformer';

export interface ICreateApplicationLoadBalancerProps extends ILoadBalancerModalProps {
  application: any;
  loadBalancer: any;
}

export interface ICreateApplicationLoadBalancerState {
  includeSecurityGroups?: boolean;
  isNew: boolean;
  loadBalancerCommand: any;
  taskMonitor: TaskMonitor;
}

export class ALBConfigureLoadBalancerModal extends React.Component<
  ICreateApplicationLoadBalancerProps,
  ICreateApplicationLoadBalancerState
> {
  public static defaultProps: Partial<any> = {
    closeModal: noop,
    dismissModal: noop,
  };

  private _isUnmounted = false;

  public static show(props: any): Promise<any> {
    const modalProps = { dialogClassName: 'wizard-modal modal-lg' };
    return ReactModal.show(ALBConfigureLoadBalancerModal, props, modalProps);
  }
  private $q: IQService;

  constructor(props: any) {
    super(props);
    const { application, loadBalancer, command, dismissModal, isNew }: any = props;
    const loadBalancerCommands = command
      ? command // ejecting from a wizard for alicloud
      : loadBalancer
      ? new AlicloudLoadBalancerTransformer(this.$q).convertApplicationLoadBalancerForEditing(loadBalancer)
      : new AlicloudLoadBalancerTransformer(this.$q).constructNewApplicationLoadBalancerTemplate(application);
    loadBalancerCommands.name =
      application.applicationName + '-' + loadBalancerCommands.stack + '-' + loadBalancerCommands.detail;
    this.state = {
      isNew: isNew,
      loadBalancerCommand: loadBalancerCommands,
      taskMonitor: new TaskMonitor({
        application: application,
        title: (isNew ? 'Creating ' : 'Updating ') + 'your load balancer',
        modalInstance: TaskMonitor.modalInstanceEmulation(() => dismissModal()),
      }),
    };
  }

  protected onApplicationRefresh(values: any): void {
    const { dismissModal }: any = this.props;
    if (this._isUnmounted) {
      return;
    }
    dismissModal();
    this.setState({ taskMonitor: undefined });
    const newStateParams = {
      name: values.name,
      accountId: values.credentials,
      region: values.region,
      vpcId: values.vpcId,
      provider: 'alicloud',
    };

    if (!ReactInjector.$state.includes('**.loadBalancerDetails')) {
      ReactInjector.$state.go('.loadBalancerDetails', newStateParams);
    } else {
      ReactInjector.$state.go('^.loadBalancerDetails', newStateParams);
    }
  }

  private submit = (values: any): void => {
    const { application }: any = this.props;
    const { isNew, taskMonitor } = this.state;

    const descriptor = isNew ? 'Create' : 'Update';
    taskMonitor.submit(function () {
      const params = {
        cloudProvider: 'alicloud',
        loadBalancerType: 'ALB',
        appName: application.name,
        loadBalancerName: application.applicationName + '-' + values.stack + '-' + values.detail,
        name: application.applicationName + '-' + values.stack + '-' + values.detail,
        // regionId: values.region,
      };

      values.listeners.forEach((listener: { rules: any[] }) => {
        listener.rules.forEach((rule, index) => {
          // rule.ruleName = `test-1${index}`;
          rule.priority = index + 1;
          rule.actions.forEach((a: { order: number }, index: number) => {
            a.order = index + 1;
          });
          rule.conditions.forEach(
            (c: {
              type: string;
              hostConfig: { values: string };
              values: any;
              pathConfig: { values: string };
              methodConfig: { values: string };
            }) => {
              if (c.type === 'Host') {
                c.hostConfig = { values: c.values };
                delete c.values;
              }
              if (c.type === 'Path') {
                c.pathConfig = { values: c.values };
                delete c.values;
              }
              if (c.type === 'Method') {
                c.methodConfig = { values: c.values };
                delete c.values;
              }
            },
          );
        });
      });
      values.zoneMappings.forEach((zoneMap: { vSwitchId: any; vswitchId: any }) => {
        zoneMap.vSwitchId = zoneMap.vswitchId;
        delete zoneMap.vswitchId;
      });

      return LoadBalancerWriter.upsertLoadBalancer(values, application, descriptor, params);
    });
  };
  private validate = (_values: FormikValues): FormikErrors<any> => {
    const errors = {} as FormikErrors<any>;
    return errors;
  };
  public render() {
    const { application, dismissModal, forPipelineConfig, loadBalancer }: any = this.props;
    const { isNew, loadBalancerCommand, taskMonitor } = this.state;
    let heading = forPipelineConfig ? 'Configure Application Load Balancer' : 'Create New Application Load Balancer';
    if (!isNew) {
      heading = `Edit ${loadBalancerCommand.name}: ${loadBalancerCommand.region}: ${loadBalancerCommand.credentials}`;
    }

    return (
      <WizardModal
        heading={heading}
        initialValues={loadBalancerCommand}
        taskMonitor={taskMonitor}
        dismissModal={dismissModal}
        closeModal={this.submit}
        validate={this.validate}
        submitButtonLabel={forPipelineConfig ? (isNew ? 'Add' : 'Done') : isNew ? 'Create' : 'Update'}
        render={({ formik, nextIdx, wizard }: any) => {
          return (
            <>
              <WizardPage
                label="Location"
                wizard={wizard}
                order={nextIdx()}
                render={({ innerRef }: any) => (
                  <ALBLocation
                    app={application}
                    forPipelineConfig={forPipelineConfig}
                    formik={formik}
                    isNew={isNew}
                    loadBalancer={loadBalancer}
                    ref={innerRef}
                  />
                )}
              />

              <WizardPage
                label="Server Groups"
                wizard={wizard}
                order={nextIdx()}
                render={({ innerRef }: any) => (
                  <ServerGroups
                    ref={innerRef}
                    app={application}
                    formik={formik}
                    isNew={isNew}
                    loadBalancer={loadBalancer}
                  />
                )}
              />

              <WizardPage
                label="Listeners"
                wizard={wizard}
                order={nextIdx()}
                render={({ innerRef }: any) => <ALBListeners ref={innerRef} app={application} formik={formik} />}
              />
            </>
          );
        }}
      />
    );
  }
}
