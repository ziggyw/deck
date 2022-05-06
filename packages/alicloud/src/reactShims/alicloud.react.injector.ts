import IInjectorService = angular.auto.IInjectorService;

import type { FunctionReader } from '@spinnaker/core';
import { ReactInject } from '@spinnaker/core';
import type { EvaluateCloudFormationChangeSetExecutionService } from './evaluateCloudFormationChangeSetExecution.service';
import type { AlicloudServerGroupTransformer } from '../serverGroup/serverGroup.transformer';

// prettier-ignore
export class AlicoudReactInject extends ReactInject {
  public get alicoudInstanceTypeService() { return this.$injector.get('alicloudInstanceTypeService') as any; }
  public get alicoudServerGroupCommandBuilder() { return this.$injector.get('alicloudServerGroupCommandBuilder') as any; }
  
  public get alicoudServerGroupConfigurationService() { return this.$injector.get('alicloudServerGroupConfigurationService') as any; }
  public get alicoudServerGroupTransformer() { return this.$injector.get('alicloudServerGroupTransformer') as AlicloudServerGroupTransformer; }

  public get functionReader() { return this.$injector.get('functionReader') as FunctionReader; }
  public get evaluateCloudFormationChangeSetExecutionService() { return this.$injector.get('evaluateCloudFormationChangeSetExecutionService') as EvaluateCloudFormationChangeSetExecutionService; }
  public initialize($injector: IInjectorService) {
    this.$injector = $injector;
  }
}

export const AlicloudReactInjector: AlicoudReactInject = new AlicoudReactInject();
