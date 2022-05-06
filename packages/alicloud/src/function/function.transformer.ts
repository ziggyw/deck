import { isEmpty } from 'lodash';

import type { Application } from '@spinnaker/core';
import { ALICLOUDProviderSettings } from './alicloud.settings';
import type { AlicloudFunction, AlicloudFunctionUpsertCommand } from '../domain';

export class AlicloudFunctionTransformer {
  public normalizeFunction(functionDef: AlicloudFunction): AlicloudFunction {
    const normalizedFunctionDef: AlicloudFunction = functionDef;
    normalizedFunctionDef.credentials = functionDef.account;
    return normalizedFunctionDef;
  }

  public convertFunctionForEditing = (functionDef: AlicloudFunction): AlicloudFunctionUpsertCommand => ({
    ...functionDef,
    envVariables: functionDef.environment ? functionDef.environment.variables : {},
    credentials: functionDef.account,
    tracingConfig: {
      mode: functionDef.tracingConfig ? functionDef.tracingConfig.mode : '',
    },
    deadLetterConfig: {
      targetArn: functionDef.deadLetterConfig ? functionDef.deadLetterConfig.targetArn : '',
    },
    KMSKeyArn: functionDef.kmskeyArn ? functionDef.kmskeyArn : '',
    subnetIds: functionDef.vpcConfig ? functionDef.vpcConfig.subnetIds : [],
    securityGroupIds: functionDef.vpcConfig ? functionDef.vpcConfig.securityGroupIds : [],
    vpcId: functionDef.vpcConfig ? functionDef.vpcConfig.vpcId : '',
    operation: '',
    cloudProvider: functionDef.cloudProvider,
    region: functionDef.region,
    targetGroups: isEmpty(functionDef.targetGroups) ? '' : functionDef.targetGroups,
  });

  public constructNewAlicloudFunctionTemplate(application: Application): AlicloudFunctionUpsertCommand {
    const defaultCredentials = application.defaultCredentials.alicloud || ALICLOUDProviderSettings.defaults.account;
    const defaultRegion = application.defaultRegions.alicloud || ALICLOUDProviderSettings.defaults.region;

    return {
      role: '',
      runtime: '',
      s3bucket: '',
      s3key: '',
      handler: '',
      functionName: '',
      publish: false,
      tags: {},
      memorySize: 128,
      description: '',

      credentials: defaultCredentials,
      cloudProvider: 'alicloud',
      detail: '',
      region: defaultRegion,
      envVariables: {},

      tracingConfig: {
        mode: 'PassThrough',
      },
      kmskeyArn: '',
      vpcId: '',
      subnetIds: [],
      securityGroupIds: [],
      timeout: 3,
      deadLetterConfig: {
        targetArn: '',
      },
      operation: '',
      targetGroups: '',
    };
  }
}
