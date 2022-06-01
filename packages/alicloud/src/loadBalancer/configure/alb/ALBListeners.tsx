import type { FormikErrors, FormikProps } from 'formik';
import { difference, flatten, get, some, uniq, uniqBy } from 'lodash';
import { $q } from 'ngimport';
import React from 'react';
import type { SortEnd } from 'react-sortable-hoc';
import { arrayMove, SortableContainer, SortableElement, SortableHandle } from 'react-sortable-hoc';

import type { Application, IWizardPageComponent } from '@spinnaker/core';
import { TetheredSelect } from '@spinnaker/core';
import { ConfirmationModalService, CustomLabels, Tooltip, ValidationMessage } from '@spinnaker/core';

import { ConfigureOidcConfigModal } from './ConfigureOidcConfigModal';
import { ConfigureRedirectConfigModal } from './ConfigureRedirectConfigModal';
import type { IAuthenticateOidcActionConfig } from '../../OidcConfigReader';
import { AliCloudProviderSettings } from '../../../alicloud.settings';

export interface IALBListenersState {
  certificates: { [accountId: number]: any[] };
  oidcConfigs: IAuthenticateOidcActionConfig[];
}

const DragHandle = SortableHandle(() => (
  <span className="pipeline-drag-handle clickable glyphicon glyphicon-resize-vertical" />
));

export interface IALBListenersProps {
  app: Application;
  formik: FormikProps<any>;
}

export class ALBListeners
  extends React.Component<IALBListenersProps, IALBListenersState>
  implements IWizardPageComponent<any> {
  public listenerProtocols = ['HTTP', 'HTTPS'];

  private initialActionsWithAuth: Set<any[]> = new Set();
  private initialListenersWithDefaultAuth: Set<any> = new Set();
  private removedAuthActions: Map<any, { [key: number]: any }> = new Map();

  constructor(props: IALBListenersProps) {
    super(props);
    this.state = {
      certificates: [],
      oidcConfigs: undefined,
    };

    this.props.formik.initialValues.listeners.forEach(
      (l: { defaultActions: Array<{ type: string }>; rules: Array<{ actions: any[] }> }) => {
        const hasDefaultAuth = l.defaultActions[0].type === 'authenticate-oidc';
        if (hasDefaultAuth) {
          this.initialListenersWithDefaultAuth.add(l);
        }
        l.rules.forEach((r: { actions: any[] }) => {
          if (r.actions[0].type === 'authenticate-oidc') {
            this.initialActionsWithAuth.add(r.actions);
          }
        });
      },
    );
  }

  private getAllTargetGroupsFromListeners(listeners: any[]): string[] {
    const actions = flatten(listeners.map((l) => l.defaultActions));
    let rules = flatten(listeners.map((l) => l.rules));
    rules = flatten(
      flatten(flatten(rules.map((i) => i.actions)).map((item) => item.forwardGroupConfig?.serverGroupTuples)),
    );
    actions.push(...rules);
    return uniq(actions.map((a) => a.serverGroupName));
  }

  public validate(values: any): FormikErrors<any> {
    const errors = {} as any;

    const serverGroupNames = values.targetServerGroups.map((tg: { serverGroupName: any }) => tg.serverGroupName);
    const usedTargetGroupNames = this.getAllTargetGroupsFromListeners(values.listeners);
    const unusedTargetGroupNames = difference(serverGroupNames, usedTargetGroupNames);
    if (unusedTargetGroupNames.length === 1) {
      errors.listeners = `Target group ${unusedTargetGroupNames[0]} is unused.`;
    } else if (unusedTargetGroupNames.length > 1) {
      errors.listeners = `Target groups ${unusedTargetGroupNames.join(', ')} are unused.`;
    }

    const { listeners } = values;
    if (uniqBy(listeners, 'listenerPort').length < listeners.length) {
      errors.listenerPorts = 'Multiple listeners cannot use the same listenerPort.';
    }

    const missingRuleFields = values.listeners.find((l: { defaultActions: any[]; rules: any[] }) => {
      const defaultActionsHaveMissingTarget = !!l.defaultActions.find(
        (da: { type: string; serverGroupName: any; authenticateOidcConfig: any; redirectActionConfig: any }) =>
          (da.type === 'ForwardGroup' && !da.serverGroupName) ||
          (da.type === 'Redirect' &&
            (!da.redirectActionConfig || !some(da.redirectActionConfig, (field) => field && field !== ''))),
      );
      const rulesHaveMissingFields = !!l.rules.find((rule: { actions: any[]; conditions: any[] }) => {
        const missingTargets = !!rule.actions.find(
          (a) =>
            a.type === 'ForwardGroup' && !a.forwardGroupConfig.serverGroupTuples.find((b: any) => b.serverGroupName),
        );
        const missingValue = !!rule.conditions.find((c) => {
          if (c.type === 'Method') {
            return !c.values.length;
          }
          return c.values.includes('');
        });

        // return missingTargets || missingAuth || missingValue;
        return missingTargets || missingValue;
      });

      return defaultActionsHaveMissingTarget || rulesHaveMissingFields;
    });

    if (missingRuleFields) {
      errors.listeners = `Missing types in rule configuration.`;
    }

    return errors;
  }

  private updateListeners(): void {
    this.props.formik.setFieldValue('listeners', this.props.formik.values.listeners);
  }

  private needsCert(listener: any): boolean {
    return listener.listenerProtocol === 'HTTPS';
  }

  private addListenerCertificate(listener: any): void {
    listener.certificates = listener.certificates || [];
    listener.certificates.push({
      certificateId: undefined,
    });
  }

  private removeAuthActions(listener: any): void {
    const authIndex = listener.defaultActions.findIndex((a: { type: string }) => a.type === 'authenticate-oidc');
    if (authIndex !== -1) {
      this.removeAuthAction(listener, listener.defaultActions, authIndex, -1);
    }
    listener.rules.forEach((rule: { actions: any[] }, ruleIndex: number) => {
      const index = rule.actions.findIndex((a) => a.type === 'authenticate-oidc');
      if (index !== -1) {
        this.removeAuthAction(listener, rule.actions, index, ruleIndex);
      }
    });
    this.updateListeners();
  }

  private reenableAuthActions(listener: any): void {
    const removedAuthActions = this.removedAuthActions.has(listener) ? this.removedAuthActions.get(listener) : [];
    const existingDefaultAuthAction = removedAuthActions[-1];
    if (existingDefaultAuthAction) {
      removedAuthActions[-1] = undefined;
      listener.defaultActions.unshift({ ...existingDefaultAuthAction });
    }
    listener.rules.forEach((rule: { actions: any[] }, ruleIndex: any) => {
      const existingAuthAction = removedAuthActions[ruleIndex];
      removedAuthActions[ruleIndex] = undefined;
      if (existingAuthAction) {
        rule.actions.unshift({ ...existingAuthAction });
      }
    });
  }

  private listenerProtocolChanged(listener: any, newProtocol: any): void {
    listener.listenerProtocol = newProtocol;
    if (listener.listenerProtocol === 'HTTPS') {
      listener.listenerPort = 443;
      if (!listener.certificates || listener.certificates.length === 0) {
        this.addListenerCertificate(listener);
      }
      this.reenableAuthActions(listener);
    }
    if (listener.listenerProtocol === 'HTTP') {
      listener.listenerPort = 80;
      listener.certificates.length = 0;
      this.removeAuthActions(listener);
    }
    this.updateListeners();
  }

  private listenerPortChanged(listener: any, newPort: string): void {
    listener.listenerPort = Number.parseInt(newPort, 10);
    this.updateListeners();
  }

  // private certificateTypeChanged(certificate: any, newType: string): void {
  //   certificate.type = newType;
  //   this.updateListeners();
  // }

  private handleCertificateChanged(certificate: any, newCertificateName: string): void {
    certificate.certificateId = newCertificateName;
    this.updateListeners();
  }

  private removeListener(index: number): void {
    this.props.formik.values.listeners.splice(index, 1);
    this.updateListeners();
  }

  private addListener = (): void => {
    this.props.formik.values.listeners.push({
      certificates: [],
      listenerProtocol: 'HTTP',
      listenerPort: 80,
      defaultActions: [
        {
          type: 'ForwardGroup',
          serverGroupName: '',
        },
      ],
      rules: [],
    });
    this.updateListeners();
  };

  private addRule = (listener: any): void => {
    const newRule: any = {
      // priority: listener.rules.length + 1,
      priority: null,
      actions: [
        {
          type: 'ForwardGroup',
          forwardGroupConfig: {
            serverGroupStickySession: {
              enabled: false,
            },
          },
        },
      ],
      conditions: [
        {
          type: 'Path',
          values: [''],
        },
      ],
    };

    listener.rules.push(newRule);
    this.updateListeners();
  };

  public removeRule = (listener: any, index: number): void => {
    listener.rules.splice(index, 1);
    this.updateListeners();
  };

  private handleConditionFieldChanged = (condition: any, newType: any): void => {
    condition.type = newType;

    if (newType === 'Method') {
      condition.values = [];
    }

    this.updateListeners();
  };

  private handleConditionValueChanged = (condition: any, newValue: string): void => {
    condition.values[0] = newValue;
    this.updateListeners();
  };

  private handleHttpRequestMethodChanged = (condition: any, newValue: string, selected: boolean): void => {
    let newValues = condition.values || [];

    if (selected) {
      newValues.push(newValue);
    } else {
      newValues = newValues.filter((v: string) => v !== newValue);
    }

    condition.values = newValues;
    // condition.httpRequestMethodConfig = {
    //   values: newValues,
    // };
    this.updateListeners();
  };

  private addCondition = (rule: any): void => {
    if (rule.conditions.length === 1) {
      const type = rule.conditions[0].type === 'Path' ? 'Host' : 'Path';
      rule.conditions.push({ type, values: [''] });
    }
    this.updateListeners();
  };

  private removeCondition = (rule: any, index: number): void => {
    rule.conditions.splice(index, 1);
    this.updateListeners();
  };

  private handleRuleActionTargetChanged = (action: any, newTarget: any, isDefault: boolean): void => {
    if (isDefault) {
      action.serverGroupName = newTarget;
    } else {
      action.forwardGroupConfig = {
        serverGroupTuples: newTarget.map((server: { value: any }) => ({
          serverGroupName: server.value,
          weight: 50,
        })),
      };
    }

    this.updateListeners();
  };

  private handleRuleActionTypeChanged = (action: any, newType: any): void => {
    action.type = newType;

    if (action.type === 'ForwardGroup') {
      delete action.redirectActionConfig;
      action.forwardGroupConfig = { serverGroupStickySession: { enabled: false } };
    } else if (action.type === 'Redirect') {
      delete action.forwardGroupConfig;
      action.redirectActionConfig = {
        httpCode: 'HTTP_301',
      };
      delete action.serverGroupName;
    }
    this.updateListeners();
  };

  private handleSortEnd = (sortEnd: SortEnd, listener: any): void => {
    listener.rules = arrayMove(listener.rules, sortEnd.oldIndex, sortEnd.newIndex);
    this.updateListeners();
  };

  private configureOidcClient = (action: any): void => {
    ConfigureOidcConfigModal.show({ config: action.authenticateOidcConfig })
      .then((config: any) => {
        action.authenticateOidcConfig = config;
        this.updateListeners(); // pushes change to formik, needed due to prop mutation
      })
      .catch(() => {});
  };

  private configureRedirect = (action: any): void => {
    ConfigureRedirectConfigModal.show({ config: action.redirectActionConfig })
      .then((config: any) => {
        action.redirectActionConfig = config;
        this.updateListeners(); // pushes change to formik, needed due to prop mutation
      })
      .catch(() => {});
  };

  private removeAuthActionInternal(listener: any, actions: any[], authIndex: number, ruleIndex = -1): void {
    const removedAuthAction = actions.splice(authIndex, 1)[0];
    if (!this.removedAuthActions.has(listener)) {
      this.removedAuthActions.set(listener, []);
    }
    this.removedAuthActions.get(listener)[ruleIndex || -1] = removedAuthAction;
    this.updateListeners();
  }

  private removeAuthAction(listener: any, actions: any[], authIndex: number, ruleIndex = -1): void {
    // TODO: Check if initial is true.
    const confirmDefaultRemove = ruleIndex === -1 && this.initialListenersWithDefaultAuth.has(listener);
    const confirmRemove = ruleIndex > -1 && this.initialActionsWithAuth.has(actions);

    if (confirmDefaultRemove || confirmRemove) {
      // TODO: Confirmation Dialog first.
      ConfirmationModalService.confirm({
        header: 'Really remove authentication?',
        buttonText: `Remove Auth`,
        submitMethod: () => {
          this.removeAuthActionInternal(listener, actions, authIndex, ruleIndex);
          if (confirmDefaultRemove) {
            this.initialListenersWithDefaultAuth.delete(listener);
          }
          if (confirmRemove) {
            this.initialActionsWithAuth.delete(actions);
          }
          return $q.resolve();
        },
      });
    } else {
      this.removeAuthActionInternal(listener, actions, authIndex, ruleIndex);
    }
  }

  private oidcConfigChanged = (action: any, config: IAuthenticateOidcActionConfig) => {
    action.authenticateOidcConfig = { ...config };
    this.updateListeners();
  };

  private redirectConfigChanged = (action: any, config: any) => {
    action.redirectActionConfig = { ...config };
    this.updateListeners();
  };

  public render() {
    const { errors, values } = this.props.formik;
    const { oidcConfigs } = this.state;
    return (
      <div className="container-fluid form-horizontal">
        <div className="form-group">
          <div className="col-md-12">
            {values.listeners.map(
              (
                listener: {
                  listenerProtocol: string | number | readonly string[];
                  listenerPort: any;
                  certificates: any[];
                },
                index: any,
              ) => (
                <div key={index} className="wizard-pod">
                  <div>
                    <div className="wizard-pod-row header">
                      <div className="wizard-pod-row-title">Listen On</div>
                      <div className="wizard-pod-row-contents spread">
                        <div>
                          <span className="wizard-pod-content">
                            <label>Protocol</label>
                            <select
                              className="form-control input-sm inline-number"
                              style={{ width: '80px' }}
                              value={listener.listenerProtocol}
                              onChange={(event) => this.listenerProtocolChanged(listener, event.target.value as any)}
                            >
                              {this.listenerProtocols.map((p) => (
                                <option key={p}>{p}</option>
                              ))}
                            </select>
                          </span>
                          <span className="wizard-pod-content">
                            <label>Port</label>
                            <input
                              className="form-control input-sm inline-number"
                              type="text"
                              min={0}
                              value={listener.listenerPort || ''}
                              onChange={(event) => this.listenerPortChanged(listener, event.target.value)}
                              style={{ width: '80px' }}
                              required={true}
                            />
                          </span>
                        </div>
                        <div>
                          <a className="sm-label clickable" onClick={() => this.removeListener(index)}>
                            <span className="glyphicon glyphicon-trash" />
                          </a>
                        </div>
                      </div>
                    </div>
                    {this.needsCert(listener) && (
                      <div className="wizard-pod-row">
                        <div className="wizard-pod-row-title">Certificate</div>
                        <div className="wizard-pod-row-contents">
                          {listener.certificates.map((certificate, cIndex) => (
                            <div key={cIndex} style={{ width: '100%', display: 'flex', flexDirection: 'row' }}>
                              <input
                                className="form-control input-sm no-spel"
                                style={{ display: 'inline-block' }}
                                type="text"
                                value={certificate?.certificateId}
                                onChange={(event) => this.handleCertificateChanged(certificate, event.target.value)}
                                required={true}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="wizard-pod-row">
                      <div className="wizard-pod-row-contents" style={{ padding: '0' }}>
                        <table className="table table-condensed packed rules-table">
                          <thead>
                            <tr>
                              <th style={{ width: '15px', padding: '0' }} />
                              <th>If</th>
                              <th style={{ width: '315px' }}>Then</th>
                              <th style={{ width: '45px' }} />
                            </tr>
                          </thead>
                          <Rules
                            addCondition={this.addCondition}
                            addRule={this.addRule}
                            // authenticateRuleToggle={this.authenticateRuleToggle}
                            distance={10}
                            handleConditionFieldChanged={this.handleConditionFieldChanged}
                            handleConditionValueChanged={this.handleConditionValueChanged}
                            handleHttpRequestMethodChanged={this.handleHttpRequestMethodChanged}
                            handleRuleActionTargetChanged={this.handleRuleActionTargetChanged}
                            handleRuleActionTypeChanged={this.handleRuleActionTypeChanged}
                            listener={listener}
                            helperClass="rule-sortable-helper"
                            removeRule={this.removeRule}
                            removeCondition={this.removeCondition}
                            targetServerGroups={values.targetServerGroups}
                            oidcConfigs={oidcConfigs}
                            oidcConfigChanged={this.oidcConfigChanged}
                            redirectConfigChanged={this.redirectConfigChanged}
                            onSortEnd={(sortEnd) => this.handleSortEnd(sortEnd, listener)}
                            configureOidcClient={this.configureOidcClient}
                            configureRedirect={this.configureRedirect}
                          />
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ),
            )}
            {errors.listenerPorts && (
              <div className="wizard-pod-row-errors">
                <ValidationMessage type="error" message={errors.listenerPorts} />
              </div>
            )}
            {errors.listeners && (
              <div className="wizard-pod-row-errors">
                <ValidationMessage type="error" message={errors.listeners} />
              </div>
            )}
            <table className="table table-condensed packed">
              <tbody>
                <tr>
                  <td>
                    <button type="button" className="add-new col-md-12" onClick={this.addListener}>
                      <span>
                        <span className="glyphicon glyphicon-plus-sign" /> Add new listener
                      </span>
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

interface IRuleProps {
  rule: any;
  listener: any;
  index: number;
  targetServerGroups: any[];
  oidcConfigChanged: (action: any, config: IAuthenticateOidcActionConfig) => void;
  redirectConfigChanged: (action: any, config: any) => void;
  oidcConfigs: IAuthenticateOidcActionConfig[];
  ruleIndex: number;
  // authenticateRuleToggle: (listener: any, index: number) => void;
  removeRule: (listener: any, index: number) => void;
  handleRuleActionTargetChanged: (action: any, newTarget: string, isDefault: boolean) => void;
  handleRuleActionTypeChanged: (action: any, newType: string) => void;
  addCondition: (rule: any) => void;
  removeCondition: (rule: any, index: number) => void;
  handleConditionFieldChanged: (condition: any, newType: any) => void;
  handleConditionValueChanged: (condition: any, newValue: string) => void;
  handleHttpRequestMethodChanged: (condition: any, newValue: string, selected: boolean) => void;
  configureOidcClient: (action: any) => void;
  configureRedirect: (action: any) => void;
}

const Rule = SortableElement((props: IRuleProps) => (
  <tr className="listener-rule">
    <td className="handle">
      <DragHandle />
    </td>
    <td>
      {props.rule.conditions.map(
        (
          condition: {
            type: string | number | readonly string[];
            values: string | Array<string | number | readonly string[]>;
          },
          cIndex: React.Key,
        ) => (
          <div key={cIndex} className="listener-rule-condition">
            <select
              className="form-control input-sm inline-number"
              value={condition.type}
              onChange={(event) => props.handleConditionFieldChanged(condition, event.target.value as any)}
              style={{ width: '40%' }}
              required={true}
            >
              {(props.rule.conditions.length === 1 || condition.type === 'Host') && <option value="Host">Host</option>}
              {(props.rule.conditions.length === 1 || condition.type === 'Path') && <option value="Path">Path</option>}
              {(props.rule.conditions.length === 1 || condition.type === 'Method') && (
                <option value="Method">Method(s)</option>
              )}
            </select>
            {condition.type !== 'Method' && (
              <input
                className="form-control input-sm"
                type="text"
                value={condition.values[0]}
                onChange={(event) => props.handleConditionValueChanged(condition, event.target.value)}
                maxLength={128}
                required={true}
                style={{ width: '63%' }}
              />
            )}
            {condition.type === 'Method' && (
              <div className="col-md-6 checkbox">
                {['DELETE', 'GET', 'PATCH', 'POST', 'PUT'].map((httpMethod) => (
                  <label key={`${httpMethod}-checkbox`}>
                    <input
                      type="checkbox"
                      checked={condition.values.includes(httpMethod)}
                      onChange={(event) =>
                        props.handleHttpRequestMethodChanged(condition, httpMethod, event.target.checked)
                      }
                    />
                    {httpMethod}
                  </label>
                ))}
              </div>
            )}
            <span className="remove-condition">
              {cIndex === 1 && (
                <a
                  className="btn btn-sm btn-link clickable"
                  onClick={() => props.removeCondition(props.rule, cIndex)}
                  style={{ padding: '0' }}
                >
                  <Tooltip value="Remove Condition">
                    <span className="glyphicon glyphicon-trash" />
                  </Tooltip>
                </a>
              )}
            </span>
          </div>
        ),
      )}
      {props.rule.conditions.length === 1 && (
        <div className="add-new-container">
          <button type="button" className="add-new col-md-12" onClick={() => props.addCondition(props.rule)}>
            <span>
              <span className="glyphicon glyphicon-plus-sign" /> Add new condition
            </span>
          </button>
          <span style={{ minWidth: '15px' }} />
        </div>
      )}
    </td>
    <td>
      {props.rule.actions.map((action: any, index: React.Key) => (
        <Action
          key={index}
          action={action}
          actionTypeChanged={(type) => props.handleRuleActionTypeChanged(action, type)}
          oidcConfigChanged={(config) => props.oidcConfigChanged(action, config)}
          redirectConfigChanged={(config) => props.redirectConfigChanged(action, config)}
          targetChanged={(target, isDefault) => props.handleRuleActionTargetChanged(action, target, isDefault)}
          targetServerGroups={props.targetServerGroups}
          oidcConfigs={props.oidcConfigs}
          configureOidcClient={props.configureOidcClient}
          configureRedirect={props.configureRedirect}
        />
      ))}
    </td>
    <td>
      <RuleActions
        ruleIndex={props.ruleIndex}
        listener={props.listener}
        // authenticateRuleToggle={props.authenticateRuleToggle}
        removeRule={props.removeRule}
        actions={props.rule.actions}
      />
    </td>
  </tr>
));

const Action = (props: {
  isDefaultAction?: boolean;
  action: any;
  oidcConfigChanged: (config: IAuthenticateOidcActionConfig) => void;
  redirectConfigChanged: (config: any) => void;
  actionTypeChanged: (actionType: string) => void;
  targetChanged: (newTarget: string, isDefault: boolean) => void;
  targetServerGroups: any[];
  oidcConfigs: IAuthenticateOidcActionConfig[];
  configureOidcClient: (action: any) => void;
  configureRedirect: (action: any) => void;
}) => {
  if (props.action.type !== 'authenticate-oidc') {
    const redirectConfig = props.action.redirectActionConfig || props.action.redirectConfig;
    // TODO: Support redirect
    return (
      <div className="horizontal top">
        <select
          className="form-control input-sm"
          style={{ width: '80px' }}
          value={props.action.type}
          onChange={(event) => props.actionTypeChanged(event.target.value)}
        >
          <option value="ForwardGroup">forward to</option>
          <option value="Redirect">redirect to</option>
        </select>
        {props.action.type === 'ForwardGroup' &&
          (!props.isDefaultAction ? (
            <TetheredSelect
              style={{ minWidth: '200px' }}
              multi={true}
              options={uniq(
                props.targetServerGroups.map((tg) => ({ value: tg.serverGroupName, label: tg.serverGroupName })),
              )}
              value={props.action?.forwardGroupConfig?.serverGroupTuples?.map(
                (tg: { serverGroupName: any }) => tg.serverGroupName,
              )}
              required={true}
              //@ts-ignore
              onChange={(event) => props.targetChanged(event, props.isDefaultAction)}
            />
          ) : (
            <select
              className="form-control input-sm"
              value={props.action.serverGroupName}
              onChange={(event) => props.targetChanged(event.target.value, props.isDefaultAction)}
              required={true}
            >
              <option value="" />
              {uniq(props.targetServerGroups.map((tg) => tg.serverGroupName)).map((serverGroupName) => (
                <option key={serverGroupName}>{serverGroupName}</option>
              ))}
            </select>
          ))}
        {props.action.type === 'Redirect' && (
          <dl className="dl-horizontal dl-narrow">
            {/* <dt>Host</dt>
            <dd>{redirectConfig.host}</dd> */}
            <dt>Path</dt>
            <dd>{redirectConfig.path}</dd>
            <dt>Port</dt>
            <dd>{redirectConfig.port}</dd>
            <dt>Protocol</dt>
            <dd>{redirectConfig.protocol}</dd>
            <dt>Query</dt>
            <dd>{redirectConfig.query}</dd>
            <dt>Http Code</dt>
            <dd>{redirectConfig.httpCode}</dd>
            <dt>
              <button
                className="btn btn-link no-padding"
                type="button"
                onClick={() => props.configureRedirect(props.action)}
              >
                Configure...
              </button>
            </dt>
          </dl>
        )}
      </div>
    );
  }
  if (props.action.type === 'authenticate-oidc') {
    const clientId = props.action.authenticateOidcConfig.clientId;

    const disableManualOidcDialog = get(AliCloudProviderSettings, 'loadBalancers.disableManualOidcDialog', false);
    const showOidcConfigs =
      disableManualOidcDialog ||
      (props.oidcConfigs &&
        props.oidcConfigs.length > 0 &&
        (!clientId || props.oidcConfigs.find((c) => c.clientId === clientId)));

    const oidcOptions = props.oidcConfigs?.length ? (
      props.oidcConfigs.map((config) => <option key={config.clientId}>{config.clientId}</option>)
    ) : (
      <option disabled>No {CustomLabels.get('OIDC client')} config found</option>
    );

    return (
      <div className="horizontal middle" style={{ height: '30px' }}>
        <span style={{ whiteSpace: 'pre' }}>auth with {CustomLabels.get('OIDC client')} </span>

        {showOidcConfigs && (
          <select
            className="form-control input-sm"
            value={clientId}
            onChange={(event) =>
              props.oidcConfigChanged(props.oidcConfigs.find((c) => c.clientId === event.target.value))
            }
            required={true}
          >
            <option value="" />
            {oidcOptions}
          </select>
        )}
        {!showOidcConfigs && (
          // a link text to open an oidc modal that is labeled with the client_id
          <a onClick={() => props.configureOidcClient(props.action)} className="clickable">
            {clientId || 'Configure...'}
          </a>
        )}
        <span style={{ whiteSpace: 'pre' }}>
          <em> and then</em>
        </span>
      </div>
    );
  }

  return null;
};

const RuleActions = (props: {
  ruleIndex?: number;
  actions: any[];
  listener: any;
  removeRule?: (listener: any, index: number) => void;
}) => {
  return (
    <span>
      {props.ruleIndex !== undefined && props.ruleIndex >= 0 && props.removeRule && (
        <a
          className="btn btn-sm btn-link clickable"
          onClick={() => props.removeRule(props.listener, props.ruleIndex)}
          style={{ padding: '0' }}
        >
          <Tooltip value="Remove Rule">
            <i className="far fa-fw fa-trash-alt" />
          </Tooltip>
        </a>
      )}
    </span>
  );
};

interface IRulesProps {
  addRule: (listener: any) => void;
  removeRule: (listener: any, index: number) => void;
  handleRuleActionTargetChanged: (action: any, newTarget: string, isDefault: boolean) => void;
  handleRuleActionTypeChanged: (action: any, type: string) => void;
  addCondition: (rule: any) => void;
  removeCondition: (rule: any, index: number) => void;
  handleConditionFieldChanged: (condition: any, newType: any) => void;
  handleConditionValueChanged: (condition: any, newValue: string) => void;
  handleHttpRequestMethodChanged: (condition: any, newValue: string, selected: boolean) => void;
  listener: any;
  targetServerGroups: any[];
  oidcConfigChanged: (action: any, config: IAuthenticateOidcActionConfig) => void;
  redirectConfigChanged: (action: any, config: any) => void;
  oidcConfigs: IAuthenticateOidcActionConfig[];
  configureOidcClient: (action: any) => void;
  configureRedirect: (action: any) => void;
}

const Rules = SortableContainer((props: IRulesProps) => (
  <tbody>
    <tr className="not-sortable">
      <td />
      <td>Default</td>
      <td>
        {props.listener.defaultActions.map((action: any, index: React.Key) => (
          <Action
            isDefaultAction={true}
            key={index}
            action={action}
            actionTypeChanged={(type) => props.handleRuleActionTypeChanged(action, type)}
            targetChanged={(target, isDefault) => props.handleRuleActionTargetChanged(action, target, isDefault)}
            targetServerGroups={props.targetServerGroups}
            oidcConfigs={props.oidcConfigs}
            oidcConfigChanged={(config) => props.oidcConfigChanged(action, config)}
            redirectConfigChanged={(config) => props.redirectConfigChanged(action, config)}
            configureOidcClient={props.configureOidcClient}
            configureRedirect={props.configureRedirect}
          />
        ))}
      </td>
      <td>
        <RuleActions listener={props.listener} actions={props.listener.defaultActions} />
      </td>
    </tr>
    {props.listener.rules
      .sort((a: { priority: number }, b: { priority: number }) => (a.priority as number) - (b.priority as number))
      .map((rule: any, index: any) => (
        <Rule
          key={index}
          rule={rule}
          addCondition={props.addCondition}
          handleConditionFieldChanged={props.handleConditionFieldChanged}
          handleConditionValueChanged={props.handleConditionValueChanged}
          handleHttpRequestMethodChanged={props.handleHttpRequestMethodChanged}
          handleRuleActionTargetChanged={props.handleRuleActionTargetChanged}
          handleRuleActionTypeChanged={props.handleRuleActionTypeChanged}
          oidcConfigChanged={props.oidcConfigChanged}
          redirectConfigChanged={props.redirectConfigChanged}
          removeCondition={props.removeCondition}
          removeRule={props.removeRule}
          targetServerGroups={props.targetServerGroups}
          oidcConfigs={props.oidcConfigs}
          listener={props.listener}
          index={index}
          ruleIndex={index}
          configureOidcClient={props.configureOidcClient}
          configureRedirect={props.configureRedirect}
        />
      ))}
    <tr className="not-sortable">
      <td colSpan={5}>
        <button type="button" className="add-new col-md-12" onClick={() => props.addRule(props.listener)}>
          <span>
            <span className="glyphicon glyphicon-plus-sign" /> Add new rule
          </span>
        </button>
      </td>
    </tr>
  </tbody>
));
