import { cloneDeep } from 'lodash';
import React from 'react';

import type { IFunctionModalProps } from '@spinnaker/core';
import { FunctionWriter, noop, ReactInjector, ReactModal, TaskMonitor, WizardModal, WizardPage } from '@spinnaker/core';

import { ExecutionRole } from './configure/ExecutionRole';
import { FunctionBasicInformation } from './configure/FunctionBasicInformation';
import { FunctionDebugAndErrorHandling } from './configure/FunctionDebugAndErrorHandling';
import { FunctionEnvironmentVariables } from './configure/FunctionEnvironmentVariables';
import { FunctionSettings } from './configure/FunctionSettings';
import { FunctionTags } from './configure/FunctionTags';
import { Network } from './configure/Network';
// import type { any, any } from '../domain';
import { AlicloudFunctionTransformer } from './function.transformer';

export interface IAlicloudCreateFunctionProps extends IFunctionModalProps {
  functionDef: any;
}
export interface IAlicloudCreateFunctionState {
  isNew: boolean;
  functionCommand: any;
  taskMonitor: TaskMonitor;
}

export class CreateLambdaFunction extends React.Component<IAlicloudCreateFunctionProps, IAlicloudCreateFunctionState> {
  public static defaultProps: Partial<IAlicloudCreateFunctionProps> = {
    closeModal: noop,
    dismissModal: noop,
  };

  constructor(props: IAlicloudCreateFunctionProps) {
    super(props);
    const functionTransformer = new AlicloudFunctionTransformer();
    const funcCommand = props.functionDef
      ? functionTransformer.convertFunctionForEditing(props.functionDef)
      : functionTransformer.constructNewAlicloudFunctionTemplate(props.app);
    this.state = {
      isNew: !props.functionDef,
      functionCommand: funcCommand,
      taskMonitor: null,
    };
  }

  private _isUnmounted = false;
  private refreshUnsubscribe: () => void;

  public static show(props: IAlicloudCreateFunctionProps): Promise<any> {
    const modalProps = { dialogClassName: 'wizard-modal modal-lg' };
    return ReactModal.show(CreateLambdaFunction, props, modalProps);
  }

  public componentWillUnmount(): void {
    this._isUnmounted = true;
    if (this.refreshUnsubscribe) {
      this.refreshUnsubscribe();
    }
  }

  protected onApplicationRefresh(values: any): void {
    if (this._isUnmounted) {
      return;
    }

    this.refreshUnsubscribe = undefined;
    this.props.dismissModal();
    this.setState({ taskMonitor: undefined });
    const newStateParams = {
      name: values.name,
      accountId: values.credentials,
      region: values.region,
      vpcId: values.vpcId,
      provider: 'alicloud',
    };

    if (!ReactInjector.$state.includes('**.functionDetails')) {
      ReactInjector.$state.go('.functionDetails', newStateParams);
    } else {
      ReactInjector.$state.go('^.functionDetails', newStateParams);
    }
  }

  private onTaskComplete(values: any): void {
    this.props.app.functions.refresh();
    this.refreshUnsubscribe = this.props.app.functions.onNextRefresh(null, () => this.onApplicationRefresh(values));
  }

  private checkForS3Update(functionCommandFormatted: any, descriptor: string): void {
    const { isNew } = this.state;
    if (!isNew && (functionCommandFormatted.s3bucket || functionCommandFormatted.s3key)) {
      functionCommandFormatted.operation = 'updateLambdaFunctionCode';
      const { app } = this.props;
      FunctionWriter.upsertFunction(functionCommandFormatted, app, descriptor);
    }
    this.onTaskComplete(functionCommandFormatted);
  }

  private submit = (values: any): void => {
    const { app } = this.props;
    const { isNew } = this.state;
    const functionCommandFormatted = cloneDeep(values);

    const descriptor = isNew ? 'Create' : 'Update';

    const taskMonitor = new TaskMonitor({
      application: app,
      title: `${isNew ? 'Creating' : 'Updating'} your function`,
      modalInstance: TaskMonitor.modalInstanceEmulation(() => this.props.dismissModal()),
      onTaskComplete: () => {
        this.checkForS3Update(functionCommandFormatted, descriptor);
      },
    });

    taskMonitor.submit(() => {
      functionCommandFormatted.type = 'lambdaFunction';
      if (!isNew) {
        functionCommandFormatted.operation = 'updateLambdaFunctionConfiguration';
      } else {
        functionCommandFormatted.operation = 'createAliCloudLambdaFunction';
      }
      return FunctionWriter.upsertFunction(functionCommandFormatted, app, descriptor);
    });
    this.setState({ taskMonitor });
  };

  public render() {
    const { app, dismissModal, forPipelineConfig, functionDef } = this.props;
    const { isNew, functionCommand, taskMonitor } = this.state;

    let heading = forPipelineConfig ? 'Configure Existing Function' : 'Create New Function';
    if (!isNew) {
      heading = `Edit ${functionCommand.functionName}: ${functionCommand.region}: ${functionCommand.credentials}`;
    }

    return (
      <WizardModal<any>
        heading={heading}
        initialValues={functionCommand}
        taskMonitor={taskMonitor}
        dismissModal={dismissModal}
        closeModal={this.submit}
        submitButtonLabel={forPipelineConfig ? (isNew ? 'Add' : 'Done') : isNew ? 'Create' : 'Update'}
        render={({ formik, nextIdx, wizard }) => {
          return (
            <>
              <WizardPage
                label="Basic information"
                wizard={wizard}
                order={nextIdx()}
                render={({ innerRef }) => (
                  <FunctionBasicInformation
                    ref={innerRef}
                    app={app}
                    formik={formik}
                    isNew={isNew}
                    functionDef={functionDef}
                  />
                )}
              />
              <WizardPage
                label="Execution Role"
                wizard={wizard}
                order={nextIdx()}
                render={({ innerRef }) => {
                  return <ExecutionRole ref={innerRef} formik={formik} isNew={isNew} functionDef={functionDef} />;
                }}
              />
              <WizardPage
                label="Environment"
                wizard={wizard}
                order={nextIdx()}
                render={({ innerRef }) => {
                  return (
                    <FunctionEnvironmentVariables
                      ref={innerRef}
                      formik={formik}
                      isNew={isNew}
                      functionDef={functionDef}
                    />
                  );
                }}
              />
              <WizardPage
                label="Tags"
                wizard={wizard}
                order={nextIdx()}
                render={({ innerRef }) => {
                  return <FunctionTags ref={innerRef} formik={formik} isNew={isNew} functionDef={functionDef} />;
                }}
              />
              <WizardPage
                label="Settings"
                wizard={wizard}
                order={nextIdx()}
                render={({ innerRef }) => {
                  return <FunctionSettings ref={innerRef} formik={formik} isNew={isNew} functionDef={functionDef} />;
                }}
              />
              <WizardPage
                label="Network"
                wizard={wizard}
                order={nextIdx()}
                render={({ innerRef }) => {
                  return <Network ref={innerRef} app={app} formik={formik} isNew={isNew} />;
                }}
              />
              <WizardPage
                label="Debugging and Error Handling"
                wizard={wizard}
                order={nextIdx()}
                render={({ innerRef }) => {
                  return (
                    <FunctionDebugAndErrorHandling
                      ref={innerRef}
                      formik={formik}
                      isNew={isNew}
                      functionDef={functionDef}
                    />
                  );
                }}
              />
            </>
          );
        }}
      />
    );
  }
}
