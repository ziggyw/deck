import type { FormikErrors, FormikProps } from 'formik';
import { filter, flatten, groupBy, set, uniq } from 'lodash';
import React from 'react';
import { from as observableFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import type { Application, IWizardPageComponent } from '@spinnaker/core';
import {
  FormValidator,
  spelNumberCheck,
  SpelNumberInput,
  SpInput,
  ValidationMessage,
  Validators,
} from '@spinnaker/core';

import { isNameInUse, isNameLong, isValidHealthCheckInterval, isValidTimeout } from '../serverGroupValidators';

export interface IServerGroupsProps {
  app: Application;
  formik: FormikProps<any>;
  isNew: boolean;
  loadBalancer: any;
}

export interface IServerGroupsState {
  existingTargetGroupNames: { [account: string]: { [region: string]: string[] } };
  oldTargetGroupCount: number;
}

export interface IServerGroup {
  serverGroupName: string;
  protocol: string;
  Scheduler: string;
  serverGroupType: string;
  healthCheckConfig: {};
  stickySessionConfig: {};
}

export class ServerGroups
  extends React.Component<IServerGroupsProps, IServerGroupsState>
  implements IWizardPageComponent<any> {
  public protocols = ['HTTP', 'HTTPS'];
  public serverGroupTypes = ['Instance', 'Ip', 'Fc'];
  public schedulers = ['Wrr', 'Wlc', 'Sch'];
  public stickySessionTypes = ['Insert', 'Server'];
  private destroy$ = new Subject();

  constructor(props: IServerGroupsProps) {
    super(props);

    const oldTargetGroupCount = !props.isNew ? props.formik.initialValues.targetServerGroups.length : 0;
    this.state = {
      existingTargetGroupNames: {},
      oldTargetGroupCount,
    };
  }

  public validate(values: any): FormikErrors<any> {
    const duplicateServerGroups = uniq(
      flatten(filter(groupBy(values.targetServerGroups, 'serverGroupName'), (count) => count.length > 1)).map(
        (tg: any) => tg.name,
      ),
    );

    const formValidator = new FormValidator(values);
    const { arrayForEach } = formValidator;

    formValidator.field('targetServerGroups').withValidators(
      arrayForEach((builder, item) => {
        builder
          .field('serverGroupName', 'Group Name')
          .withValidators(
            isNameInUse(this.state.existingTargetGroupNames, values.credentials, values.region),
            isNameLong(this.props.app.name.length),
            Validators.valueUnique(
              duplicateServerGroups,
              'There is already a target group in this load balancer with the same name.',
            ),
          );
        builder
          .field('healthCheckConfig.healthCheckInterval', 'Health Check Interval')
          .withValidators(isValidHealthCheckInterval(item), Validators.checkBetween('healthCheckInterval', 1, 300));
        builder
          .field('healthCheckConfig.healthyThreshold', 'Healthy Threshold')
          .withValidators(Validators.checkBetween('healthyThreshold', 2, 10));
        builder
          .field('healthCheckConfig.unhealthyThreshold', 'Unhealthy Threshold')
          .spelAware()
          .withValidators(Validators.checkBetween('unhealthyThreshold', 2, 10));
        builder
          .field('healthCheckConfig.healthCheckTimeout', 'Timeout')
          .withValidators(isValidTimeout(item), Validators.checkBetween('healthCheckTimeout', 1, 300));

        if (item.serverGroupType !== 'Fc') {
          // builder.field('protocol', 'Protocol').required();
          builder.field('healthCheckConfig.healthCheckPath', 'Health Check Path').required();
          // builder.field('healthCheckConfig.healthCheckProtocol', 'Health Check Protocol').required();
          builder.field('serverGroupName', 'Group Name').required();
          builder
            .field('healthCheckConfig.healthyThreshold', 'Healthy Threshold')
            .required()
            .spelAware()
            .withValidators((value) => spelNumberCheck(value));
          builder
            .field('healthCheckConfig.unhealthyThreshold', 'Unhealthy Threshold')
            .required()
            .spelAware()
            .withValidators((value) => spelNumberCheck(value));
          builder
            .field('healthCheckConfig.healthCheckInterval', 'Health Check Interval')
            .required()
            .spelAware()
            .withValidators((value) => spelNumberCheck(value));
          builder
            .field('healthCheckConfig.healthCheckConnectPort', 'Health Check Port')
            .required()
            .spelAware()
            .withValidators((value) => (value === 'traffic-port' ? null : spelNumberCheck(value)));

          builder
            .field('healthCheckConfig.healthyThreshold', 'Healthy Threshold')
            .required()
            .spelAware()
            .withValidators((value) => spelNumberCheck(value), Validators.checkBetween('healthyThreshold', 2, 10));
          builder
            .field('healthCheckConfig.unhealthyThreshold', 'Unhealthy Threshold')
            .required()
            .spelAware()
            .withValidators((value) => spelNumberCheck(value), Validators.checkBetween('unhealthyThreshold', 2, 10));
        }
      }),
    );

    return formValidator.validateForm();
  }

  private removeAppName(name: string): string {
    return name.replace(`${this.props.app.name}-`, '');
  }

  protected updateLoadBalancerNames(props: IServerGroupsProps): void {
    const { app, loadBalancer } = props;

    const targetServerGroupsByAccountAndRegion: { [account: string]: { [region: string]: string[] } } = {};
    observableFrom(app.getDataSource('loadBalancers').refresh(true))
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        app.getDataSource('loadBalancers').data?.forEach((lb: any) => {
          if (lb.loadBalancerType !== 'classic') {
            if (!loadBalancer || lb.name !== loadBalancer.name) {
              lb.targetServerGroups?.forEach((serverGroup: { name: string }) => {
                targetServerGroupsByAccountAndRegion[lb.account] =
                  targetServerGroupsByAccountAndRegion[lb.account] || {};
                targetServerGroupsByAccountAndRegion[lb.account][lb.region] =
                  targetServerGroupsByAccountAndRegion[lb.account][lb.region] || [];
                targetServerGroupsByAccountAndRegion[lb.account][lb.region].push(this.removeAppName(serverGroup.name));
              });
            }
          }
        });

        this.setState({ existingTargetGroupNames: targetServerGroupsByAccountAndRegion }, () =>
          this.props.formik.validateForm(),
        );
      });
  }

  private serverGroupFieldChanged(index: number, field: string, value: string | boolean | number): void {
    const { setFieldValue, values } = this.props.formik;
    const serverGroup = values.targetServerGroups[index];
    if (field === 'serverGroupType' && value === 'Fc') {
      delete serverGroup.port;
    }
    set(serverGroup, field, value);
    setFieldValue('targetServerGroups', values.targetServerGroups);
  }

  private addTargetGroup = (): void => {
    const { setFieldValue, values } = this.props.formik;
    values.targetServerGroups.push({
      serverGroupName: `servergroup${values.targetServerGroups.length}`,
      protocol: 'HTTP',
      Scheduler: 'Wrr',
      serverGroupType: 'Instance',
      healthCheckConfig: {
        healthCheckConnectPort: 80,
        healthCheckEnabled: true,
        healthCheckPath: '/healthcheck',
        healthCheckTimeout: 5,
        healthCheckInterval: 10,
        healthyThreshold: 10,
        unhealthyThreshold: 2,
      },
      stickySessionConfig: {
        cookieTimeout: 300,
        stickySessionType: 'Insert',
        stickySessionEnabled: true,
      },
    });
    setFieldValue('targetServerGroups', values.targetServerGroups);
  };

  private removeTargetGroup(index: number): void {
    const { setFieldValue, values } = this.props.formik;
    const { oldTargetGroupCount } = this.state;
    values.targetServerGroups.splice(index, 1);

    if (index < oldTargetGroupCount) {
      this.setState({ oldTargetGroupCount: oldTargetGroupCount - 1 });
    }
    setFieldValue('targetServerGroups', values.targetServerGroups);
  }

  public componentDidMount(): void {
    this.updateLoadBalancerNames(this.props);
  }

  public componentWillUnmount(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public render() {
    const { app } = this.props;
    const { errors, values } = this.props.formik;
    const { oldTargetGroupCount } = this.state;

    const ProtocolOptions = this.protocols.map((p) => <option key={p}>{p}</option>);
    const TargetTypeOptions = this.serverGroupTypes.map((p) => <option key={p}>{p}</option>);
    const SchedulerOptions = this.schedulers.map((p) => <option key={p}>{p}</option>);
    const stickySessionTypeOptions = this.stickySessionTypes.map((p) => <option key={p}>{p}</option>);
    return (
      <div className="container-fluid form-horizontal">
        <div className="form-group">
          <div className="col-md-12">
            {values.targetServerGroups.map((serverGroup: any, index: any) => {
              // @ts-ignore
              const serverGroupErrors = (errors.targetServerGroups && errors.targetServerGroups[index]) || {};
              return (
                <div key={index} className="wizard-pod">
                  <div>
                    <div className="wizard-pod-row header">
                      <div className="wizard-pod-row-title">Group Name</div>
                      <div className="wizard-pod-row-contents">
                        <div className="wizard-pod-row-data">
                          <span className="group-name-prefix">{app.name}-</span>
                          <input
                            className="form-control input-sm target-group-name"
                            type="text"
                            value={serverGroup.serverGroupName}
                            onChange={(event) =>
                              this.serverGroupFieldChanged(index, 'serverGroupName', event.target.value)
                            }
                            required={true}
                            disabled={index < oldTargetGroupCount}
                          />
                          <a className="sm-label clickable" onClick={() => this.removeTargetGroup(index)}>
                            <span className="glyphicon glyphicon-trash" />
                          </a>
                        </div>
                        {serverGroupErrors.serverGroupName && (
                          <div className="wizard-pod-row-errors">
                            <ValidationMessage type="error" message={serverGroupErrors.serverGroupName} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="wizard-pod-row">
                      <div className="wizard-pod-row-title">
                        <span>Target Type&nbsp;</span>
                      </div>
                      <div className="wizard-pod-row-contents">
                        <div className="wizard-pod-row-data">
                          <span className="wizard-pod-content">
                            <select
                              className="form-control input-sm"
                              value={serverGroup.serverGroupType}
                              onChange={(event) =>
                                this.serverGroupFieldChanged(index, 'serverGroupType', event.target.value)
                              }
                              disabled={index < oldTargetGroupCount}
                            >
                              {TargetTypeOptions}
                            </select>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="wizard-pod-row">
                      <div className="wizard-pod-row-title"></div>
                      <div className="wizard-pod-row-contents">
                        <div className="wizard-pod-row-data">
                          <span className="wizard-pod-content">
                            <select
                              className="form-control input-sm"
                              value={serverGroup.Scheduler}
                              onChange={(event) => this.serverGroupFieldChanged(index, 'Scheduler', event.target.value)}
                              disabled={index < oldTargetGroupCount}
                            >
                              {SchedulerOptions}
                            </select>
                          </span>
                        </div>
                      </div>
                    </div>
                    {serverGroup.serverGroupType !== 'Fc' && (
                      <div className="wizard-pod-row">
                        <div className="wizard-pod-row-title">Backend Connection</div>
                        <div className="wizard-pod-row-contents">
                          <div className="wizard-pod-row-data">
                            <span className="wizard-pod-content">
                              <label>Protocol </label>
                              <select
                                className="form-control input-sm inline-number"
                                value={serverGroup.protocol}
                                onChange={(event) =>
                                  this.serverGroupFieldChanged(index, 'protocol', event.target.value)
                                }
                                disabled={index < oldTargetGroupCount}
                              >
                                {ProtocolOptions}
                              </select>
                            </span>
                            {/* <span className="wizard-pod-content">
                              <label>Port </label>
                              <HelpField id="alicloud.serverGroup.port" />{' '}
                              <input
                                className="form-control input-sm inline-number"
                                value={serverGroup.port}
                                onChange={(event) => this.serverGroupFieldChanged(index, 'port', event.target.value)}
                                type="text"
                                required={true}
                                disabled={index < oldTargetGroupCount}
                              />
                            </span> */}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="wizard-pod-row">
                      <div className="wizard-pod-row-title">Healthcheck</div>
                      <div className="wizard-pod-row-contents">
                        <div className="wizard-pod-row-data">
                          <label>
                            <input
                              type="checkbox"
                              checked={serverGroup.healthCheckConfig.healthCheckEnabled}
                              onChange={(event) =>
                                this.serverGroupFieldChanged(
                                  index,
                                  'healthCheckConfig.healthCheckEnabled',
                                  event.target.checked,
                                )
                              }
                            />
                            &nbsp;&nbsp; healthCheckEnabled
                          </label>
                          {serverGroup.serverGroupType !== 'Fc' && (
                            <span className="wizard-pod-content">
                              <label>Protocol </label>

                              <select
                                disabled={!serverGroup.healthCheckConfig.healthCheckEnabled}
                                className="form-control input-sm inline-number"
                                value={serverGroup.healthCheckConfig.healthCheckProtocol}
                                onChange={(event) =>
                                  this.serverGroupFieldChanged(
                                    index,
                                    'healthCheckConfig.healthCheckProtocol',
                                    event.target.value,
                                  )
                                }
                              >
                                {ProtocolOptions}
                              </select>
                            </span>
                          )}
                          {serverGroup.serverGroupType !== 'Fc' && (
                            <span className="wizard-pod-content">
                              <label>Domain </label>
                              <select
                                disabled={!serverGroup.healthCheckConfig.healthCheckEnabled}
                                className="form-control input-sm inline-number"
                                style={{ width: '90px' }}
                                value={serverGroup.healthCheckConfig.domain}
                                onChange={(event) =>
                                  this.serverGroupFieldChanged(index, 'healthCheckConfig.domain', event.target.value)
                                }
                              >
                                <option value="backendServerInternalIP">Backend ServerInternal IP</option>
                                <option value="customDomainName">Custom Domain Name</option>
                              </select>{' '}
                              {serverGroup.customDomainName && (
                                <SpInput
                                  disabled={!serverGroup.healthCheckConfig.healthCheckEnabled}
                                  className="form-control input-sm inline-number"
                                  error={serverGroupErrors.customDomainName}
                                  name="customDomainName"
                                  required={true}
                                  value={serverGroup.healthCheckConfig.customDomainName}
                                  onChange={(event) =>
                                    this.serverGroupFieldChanged(
                                      index,
                                      'healthCheckConfig.customDomainName',
                                      event.target.value,
                                    )
                                  }
                                />
                              )}
                            </span>
                          )}
                          {serverGroup.serverGroupType !== 'Fc' && (
                            <span className="wizard-pod-content">
                              <label>Port </label>
                              <select
                                disabled={!serverGroup.healthCheckConfig.healthCheckEnabled}
                                className="form-control input-sm inline-number"
                                style={{ width: '90px' }}
                                value={
                                  serverGroup.healthCheckConfig.healthCheckConnectPort === 'traffic-port'
                                    ? 'traffic-port'
                                    : 'manual'
                                }
                                onChange={(event) =>
                                  this.serverGroupFieldChanged(
                                    index,
                                    'healthCheckConfig.healthCheckConnectPort',
                                    event.target.value === 'traffic-port' ? 'traffic-port' : '',
                                  )
                                }
                              >
                                <option value="traffic-port">Traffic Port</option>
                                <option value="manual">Manual</option>
                              </select>{' '}
                              <SpInput
                                disabled={!serverGroup.healthCheckConfig.healthCheckEnabled}
                                className="form-control input-sm inline-number"
                                error={serverGroupErrors?.healthCheckConfig?.healthCheckConnectPort}
                                style={{
                                  visibility:
                                    serverGroup.healthCheckConfig.healthCheckConnectPort === 'traffic-port'
                                      ? 'hidden'
                                      : 'inherit',
                                }}
                                name="healthCheckConnectPort"
                                required={true}
                                value={serverGroup.healthCheckConfig.healthCheckConnectPort}
                                onChange={(event) =>
                                  this.serverGroupFieldChanged(
                                    index,
                                    'healthCheckConfig.healthCheckConnectPort',
                                    event.target.value,
                                  )
                                }
                              />
                            </span>
                          )}
                          {serverGroup.serverGroupType !== 'Fc' && (
                            <span className="wizard-pod-content">
                              <label>Path </label>
                              <SpInput
                                disabled={!serverGroup.healthCheckConfig.healthCheckEnabled}
                                className="form-control input-sm inline-number"
                                error={serverGroupErrors?.healthCheckConfig?.healthCheckPath}
                                name="healthCheckPath"
                                required={true}
                                value={serverGroup.healthCheckConfig.healthCheckPath}
                                onChange={(event) =>
                                  this.serverGroupFieldChanged(
                                    index,
                                    'healthCheckConfig.healthCheckPath',
                                    event.target.value,
                                  )
                                }
                              />
                            </span>
                          )}
                          <span className="wizard-pod-content">
                            <label>Timeout </label>
                            <SpelNumberInput
                              disabled={!serverGroup.healthCheckConfig.healthCheckEnabled}
                              error={serverGroupErrors?.healthCheckConfig?.healthCheckTimeout}
                              // disabled={has6sTimeout || has10sTimeout}
                              required={true}
                              // value={has6sTimeout ? 6 : has10sTimeout ? 10 : serverGroup.healthCheckTimeout}
                              value={serverGroup.healthCheckConfig.healthCheckTimeout}
                              min={1}
                              max={300}
                              onChange={(value: string | number) =>
                                this.serverGroupFieldChanged(index, 'healthCheckConfig.healthCheckTimeout', value)
                              }
                            />
                          </span>
                          <span className="wizard-pod-content">
                            <label>Interval </label>
                            <SpelNumberInput
                              disabled={!serverGroup.healthCheckConfig.healthCheckEnabled}
                              error={serverGroupErrors?.healthCheckConfig?.healthCheckInterval}
                              required={true}
                              value={serverGroup.healthCheckConfig.healthCheckInterval}
                              min={1}
                              max={50}
                              onChange={(value: string | number) =>
                                this.serverGroupFieldChanged(index, 'healthCheckConfig.healthCheckInterval', value)
                              }
                            />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="wizard-pod-row">
                      <div className="wizard-pod-row-title">Healthcheck Threshold</div>
                      <div className="wizard-pod-row-contents">
                        <div className="wizard-pod-row-data">
                          <span className="wizard-pod-content">
                            <label>Healthy </label>
                            <SpelNumberInput
                              disabled={!serverGroup.healthCheckConfig.healthCheckEnabled}
                              error={serverGroupErrors?.healthCheckConfig?.healthyThreshold}
                              value={serverGroup.healthCheckConfig.healthyThreshold}
                              min={2}
                              max={10}
                              onChange={(value: string | number) =>
                                this.serverGroupFieldChanged(index, 'healthCheckConfig.healthyThreshold', value)
                              }
                            />
                          </span>
                          <span className="wizard-pod-content">
                            <label>Unhealthy </label>
                            <SpelNumberInput
                              disabled={!serverGroup.healthCheckConfig.healthCheckEnabled}
                              error={serverGroupErrors?.healthCheckConfig?.unhealthyThreshold}
                              required={true}
                              value={serverGroup.healthCheckConfig.unhealthyThreshold}
                              min={2}
                              max={10}
                              onChange={(value: string | number) =>
                                this.serverGroupFieldChanged(index, 'healthCheckConfig.unhealthyThreshold', value)
                              }
                            />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="wizard-pod-row">
                      <div className="wizard-pod-row-title">Session Persistence</div>
                      {serverGroup.serverGroupType !== 'Fc' && (
                        <div className="wizard-pod-row">
                          <div className="wizard-pod-row-contents">
                            <div className="wizard-pod-row-data">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={serverGroup.stickySessionConfig.stickySessionEnabled}
                                  onChange={(event) =>
                                    this.serverGroupFieldChanged(
                                      index,
                                      'stickySessionConfig.stickySessionEnabled',
                                      event.target.checked,
                                    )
                                  }
                                />
                                &nbsp;&nbsp;stickySessionEnabled
                              </label>
                              <span className="wizard-pod-content">
                                <label>Protocol </label>
                                <select
                                  className="form-control input-sm inline-number"
                                  value={serverGroup.stickySessionConfig.stickySessionType}
                                  onChange={(event) =>
                                    this.serverGroupFieldChanged(
                                      index,
                                      'stickySessionConfig.stickySessionType',
                                      event.target.value,
                                    )
                                  }
                                  disabled={
                                    !serverGroup.stickySessionConfig.stickySessionEnabled || index < oldTargetGroupCount
                                  }
                                >
                                  {stickySessionTypeOptions}
                                </select>
                              </span>
                              <span className="wizard-pod-content">
                                <label>timeOut </label>
                                <input
                                  className="form-control input-sm inline-number"
                                  value={serverGroup.stickySessionConfig.cookieTimeout}
                                  onChange={(event) =>
                                    this.serverGroupFieldChanged(
                                      index,
                                      'stickySessionConfig.cookieTimeout',
                                      event.target.value,
                                    )
                                  }
                                  type="text"
                                  required={true}
                                  disabled={
                                    !serverGroup.stickySessionConfig.stickySessionEnabled || index < oldTargetGroupCount
                                  }
                                />
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <table className="table table-condensed packed">
              <tbody>
                <tr>
                  <td>
                    <button type="button" className="add-new col-md-12" onClick={this.addTargetGroup}>
                      <span className="glyphicon glyphicon-plus-sign" /> Add new target group
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
}
