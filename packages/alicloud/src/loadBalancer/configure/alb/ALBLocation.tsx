import type { FormikErrors, FormikProps } from 'formik';
import { Field } from 'formik';
import * as React from 'react';
import Select from 'react-select';
import { Subject } from 'rxjs';

import type { Application } from '@spinnaker/core';
import { HelpField } from '@spinnaker/core';
import { AccountSelectInput, AccountService, REST, Spinner, ValidationMessage } from '@spinnaker/core';

import './ALBLocation.less';

export interface IALBLocationProps {
  app: Application;
  formik: FormikProps<any>;
  forPipelineConfig?: boolean;
  isNew?: boolean;
  loadBalancer?: any;
}
export interface IALBLocationStates {
  accounts: any;
  regions: any;
  vSwitchZoneIds: any;
  vpcIdsOpt: any;
  zoneIds: any;
  vpcIds: any;
  regionIds: any;
  accountIds: any;
}

export class ALBLocation extends React.Component<IALBLocationProps, IALBLocationStates> {
  constructor(props: any) {
    super(props);
    const { app }: any = props;
    this.state = {
      accounts: app.accounts,
      regions: [],
      vSwitchZoneIds: [],
      vpcIdsOpt: [],
      zoneIds: {},
      regionIds: {},
      vpcIds: {},
      accountIds: {},
    };
    this.getAccount();
    this.getVpcIds();
  }
  public sub$ = new Subject();

  public validate(values: any): FormikErrors<any> {
    const errors = {} as any;
    const fields = ['stack', 'detail', 'region', 'addressType', 'addressAllocatedMode', 'vpcId', 'credentials'];
    const emptyTypes = fields.filter((v) => values[v] == '');
    if (emptyTypes.length !== 0) {
      errors.location = `${emptyTypes.join()} is required`;
    }
    if (values['zoneMappings'].length < 2) {
      errors.zoneMappings = 'zoneMappings is required and there are at least two vSwitch';
    }
    return errors;
  }

  public getAccount = () => {
    const that = this;
    AccountService.listAccounts('alicloud').then(function (account: any) {
      const nregion: any[] = [];
      const Account: any = [];
      account.forEach((item: any) => {
        Account.push(item.name);
      });
      account[0].regions.forEach((item: any) => {
        nregion.push({
          value: item,
          label: item,
        });
      });
      that.setState({
        regions: nregion,
      });
      that.setState({
        accounts: Account,
      });
    });
  };

  private getVpcIds() {
    const zoneIds: any = {};
    const vpcIds: any = {};
    const regionIds: any = {};
    const accountIds: any = {};
    REST('/subnets/alicloud')
      .get()
      .then((res: any) => {
        res?.forEach((item: any) => {
          if (!vpcIds[`${item.vpcId}/${item.vpcName}`]) {
            vpcIds[`${item.vpcId}/${item.vpcName}`] = new Set();
          }
          if (!zoneIds[item.zoneId]) {
            zoneIds[item.zoneId] = new Set();
          }
          if (!regionIds[item.region]) {
            regionIds[item.region] = new Set();
          }
          if (!accountIds[item.account]) {
            accountIds[item.account] = new Set();
          }
          vpcIds[`${item.vpcId}/${item.vpcName}`].add(item.zoneId);
          regionIds[item.region].add(`${item.vpcId}/${item.vpcName}`);
          accountIds[item.account].add(item.region);
          zoneIds[item.zoneId].add({ label: `${item.vswitchId}/${item.vswitchName}`, value: item.vswitchId });
        });

        this.setState({
          vpcIds,
          regionIds,
          accountIds,
          zoneIds,
        });
      });
  }

  private regionUpdated = (region: any): void => {
    const { regionIds, vpcIds, accountIds } = this.state;
    this.sub$.next(region);
    this.props.formik.setFieldValue('region', region.value);
    this.props.formik.setFieldValue('zoneMappings', []);
    this.props.formik.setFieldValue('vpcId', '');
    this.setState({
      vpcIdsOpt: Object.keys(vpcIds)
        .filter(
          (vpc) =>
            accountIds[this.props.formik.values?.credentials]?.has(region.value) && regionIds[region.value]?.has(vpc),
        )
        .map((vpc) => ({ label: vpc, value: vpc.split('/')[0] })),
      vSwitchZoneIds: [],
    });
  };

  private vpcUpdated = (vpcId: any) => {
    const { zoneIds, vpcIds } = this.state;
    this.setState({
      vSwitchZoneIds: Object.keys(zoneIds)
        .filter((zoneId) => vpcIds[vpcId?.label]?.has(zoneId))
        .map((zoneId) => ({
          zoneId,
          vSwitchs: Array.from(zoneIds[zoneId]),
        })),
    });
    this.props.formik.setFieldValue('zoneMappings', []);
    this.props.formik.setFieldValue('vpcId', vpcId.value);
  };

  // private handleZoneIdAdd = (ZoneId: any) => {
  //   this.props.formik.setFieldValue('zoneId', ZoneId.value);
  //   //@ts-ignore

  // };

  private accountUpdated = (account: string): void => {
    const { regionIds, vpcIds, accountIds } = this.state;
    this.setState({
      vpcIdsOpt: Object.keys(vpcIds)
        .filter(
          (vpc) =>
            accountIds[account]?.has(this.props.formik.values?.region) &&
            regionIds[this.props.formik.values?.region]?.has(vpc),
        )
        .map((vpc) => ({ label: vpc, value: vpc.split('/')[0] })),
    });
    this.sub$.next(account);
    this.props.formik.setFieldValue('credentials', account);
  };

  private stackChanged = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.props.formik.setFieldValue('stack', event.target.value);
  };

  private detailChanged = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.props.formik.setFieldValue('detail', event.target.value);
  };

  private addressTypeChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    if (event.target.value === 'internet') {
      this.props.formik.setFieldValue('vSwitchId', null);
      this.props.formik.setFieldValue('vSwitchName', null);
    }
    this.props.formik.setFieldValue('addressType', event.target.value);
  };

  private addressAllowModeChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    this.props.formik.setFieldValue('addressAllocatedMode', event.target.value);
  };

  public render() {
    // const { isNew }: any = this.props;-
    const { errors, values, setFieldValue }: any = this.props.formik;
    const { accounts, vSwitchZoneIds, regions, vpcIdsOpt }: any = this.state;

    return (
      <div className="container-fluid form-horizontal create-classic-load-balancer-wizard-alb">
        {!accounts && (
          <div style={{ height: '200px' }}>
            <Spinner size="medium" />
          </div>
        )}
        {accounts && (
          <div className="modal-body">
            <div className="form-group">
              <div className={`col-md-12 well ${errors.name} ? 'alert-danger' : 'alert-info'`}>
                <strong>Your load balancer will be named: </strong>
                {/* <span>{values.name}</span> */}
                {/* @ts-ignore */}
                <span>{this.props.app.applicationName + '-' + values.stack + '-' + values.detail}</span>
                {/* <HelpField id="alicloud.loadBalancer.name" /> */}
                <Field type="text" style={{ display: 'none' }} className="form-control input-sm no-spel" name="name" />
                {errors.name && <ValidationMessage type="error" message={errors.name} />}
              </div>
            </div>
            <div className="form-group">
              <div className="col-md-3 sm-label-right">Account</div>
              <div className="col-md-7">
                <AccountSelectInput
                  value={values.credentials}
                  onChange={(evt: any) => this.accountUpdated(evt.target.value)}
                  accounts={accounts}
                  provider="alicloud"
                />
              </div>
            </div>

            <div className="form-group">
              <div className="col-md-3 sm-label-right">Region</div>
              <div className="col-md-7">
                <Select options={regions} value={values.region} onChange={(evt: any) => this.regionUpdated(evt)} />
              </div>
            </div>

            <div className="form-group">
              <div className="col-md-3 sm-label-right">
                Stack
                <HelpField id="alicloud.loadBalancer.stack" />
              </div>
              <div className="col-md-3">
                <input
                  type="text"
                  className={`form-control input-sm no-spel ${errors.stack} ? 'invalid' : ''`}
                  value={values.stack}
                  name="stack"
                  onChange={this.stackChanged}
                />
              </div>
              <div className="col-md-6 form-inline">
                <label className="sm-label-right">
                  <span>
                    Detail
                    {/* <HelpField id="alicloud.loadBalancer.detail" />{' '} */}
                  </span>
                </label>
                <input
                  type="text"
                  className={`form-control input-sm no-spel ${errors.detail} ? 'invalid' : ''`}
                  value={values.detail}
                  name="detail"
                  onChange={this.detailChanged}
                />
              </div>
              {/* {errors.stack && (
                <div className="col-md-7 col-md-offset-3">
                  <ValidationMessage type="error" message={errors.stack} />
                </div>
              )}
              {errors.detail && (
                <div className="col-md-7 col-md-offset-3">
                  <ValidationMessage type="error" message={errors.detail} />
                </div>
              )} */}
            </div>

            <div className="form-group">
              <div className="col-md-3 sm-label-right">AddressType</div>
              <div className="col-md-7">
                <select className="form-control input-sm" value={values.addressType} onChange={this.addressTypeChange}>
                  <option key="internet" value="internet">
                    internet
                  </option>
                  <option key="intranet" value="intranet">
                    intranet
                  </option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <div className="col-md-3 sm-label-right">AddressAllocateMode</div>
              <div className="col-md-7">
                <select
                  className="form-control input-sm"
                  value={values.addressAllocatedMode}
                  onChange={this.addressAllowModeChange}
                >
                  <option key="Fixed" value="Fixed">
                    Fixed
                  </option>
                  <option key="Dynamic" value="Dynamic">
                    Dynamic
                  </option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <div className="col-md-3 sm-label-right">VPC Subnet</div>
              <div className="col-md-7">
                <Select
                  // disabled={values.addressType === 'internet'}
                  value={values.vpcId}
                  options={vpcIdsOpt}
                  onChange={this.vpcUpdated}
                />
              </div>
            </div>
            {errors.location && (
              <div className="col-md-7 col-md-offset-3">
                <ValidationMessage type="error" message={errors.location} />
              </div>
            )}
            {vSwitchZoneIds.length !== 0 && (
              <div className="form-group">
                {/* <div className="col-md-3 sm-label-right">ZoneMappings</div> */}
                {/* <div className="col-md-7">
                <Select
                  // disabled={values.addressType === 'internet'}
                  value={values.zoneId}
                  options={regionIdsOpt}
                  onChange={this.handleZoneIdAdd}
                />
              </div> */}

                <div className="col-md-10 top-padding">
                  <table className="table table-condensed packed ">
                    <thead>
                      <tr>
                        <th className="col-md-4">Availability Zone</th>
                        <th className="col-md-6">vSwitch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vSwitchZoneIds.map((vSwitchZoneId: any): any => (
                        <ZoneMappingsItem
                          key={vSwitchZoneId.zoneId}
                          zoneId={vSwitchZoneId.zoneId}
                          zoneMappings={values.zoneMappings}
                          setFieldValue={setFieldValue}
                          vSwitchs={vSwitchZoneId.vSwitchs}
                        />
                      ))}
                    </tbody>
                    <tfoot>
                      <tr />
                    </tfoot>
                  </table>
                </div>
                {errors.zoneMappings && (
                  <div className="col-md-7 col-md-offset-3">
                    <ValidationMessage type="error" message={errors.zoneMappings} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}

const ZoneMappingsItem = (props: { zoneId: string; zoneMappings: any; setFieldValue: any; vSwitchs: any }) => {
  const { zoneId, zoneMappings, setFieldValue } = props;
  const handleCheckboxChange = () => {
    if (!isChecked) {
      setFieldValue(
        'zoneMappings',
        zoneMappings.filter((item: { zoneId: string }) => item.zoneId !== zoneId),
      );
    }
    setIsChecked(!isChecked);
  };
  const [isChecked, setIsChecked] = React.useState(false);
  const [vSwitchId, setVSwitchId] = React.useState('');
  const handleVSwitchIdChange = (ZoneId: any) => {
    setVSwitchId(ZoneId.value);

    let flag = true;
    zoneMappings.forEach((item: { zoneId: string; vSwitchId: string }) => {
      if (item.zoneId === zoneId) {
        item.vSwitchId = ZoneId.value;
        flag = false;
      }
    }),
      flag &&
        zoneMappings.push({
          zoneId,
          vSwitchId: ZoneId.value,
        });
    setFieldValue('zoneMappings', zoneMappings);
  };

  return (
    <tr key={zoneId}>
      <td>
        <input
          className="right-padding"
          type="checkbox"
          id={zoneId}
          name="zoneId"
          checked={isChecked}
          onChange={handleCheckboxChange}
        />
        <label htmlFor={zoneId}>{zoneId}</label>{' '}
      </td>
      <td>
        <Select disabled={!isChecked} value={vSwitchId} options={props.vSwitchs} onChange={handleVSwitchIdChange} />
      </td>
    </tr>
  );
};
