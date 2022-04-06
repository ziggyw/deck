'use strict';

import { module } from 'angular';

import { CloudProviderRegistry, DeploymentStrategyRegistry } from '@spinnaker/core';

import './help/alicloud.help';
import { ALICLOUD_IMAGE } from './image/image.reader';
import { ALICLOUD_INSTANCE_SERVICE } from './instance/alicloudInstanceType.service';
import { ALICLOUD_INSTANCE_DETAILCTRL } from './instance/details/instance.details.controller';
import { ALICLOUD_LOADBALANCER_CREATE } from './loadBalancer/configure/createLoadBalancer.controller';
import { ALICLOUD_LOADBALANCER_DETAILS } from './loadBalancer/details/loadBalancerDetail.controller';
import { ALICLOUD_LOADBALANCER_BALANCER } from './loadBalancer/loadBalancer.transformer';
import alicloudlogo from './logo/alicloud.png';
import { ALICLOUD_PIPELINE_STAGES_BAKE_ALICLOUDBAKESTAGE } from './pipeline/stages/bake/alicloudBakeStage';
import { ALICLOUD_PIPELINE_STAGES_CLONESERVERGROUP_ALICLOUDCLONESERVERGROUPSTAGE } from './pipeline/stages/cloneServerGroup/alicloudCloneServerGroupStage';
import { ALICLOUD_PIPELINE_STAGES_DESTROYASG_ALICLOUDDESTROYASGSTAGE } from './pipeline/stages/destroyAsg/alicloudDestroyAsgStage';
import { ALICLOUD_PIPELINE_STAGES_DISABLECLUSTER_ALICLOUDDISABLECLUSTERSTAGE } from './pipeline/stages/disableCluster/alicloudDisableClusterStage';
import { ALICLOUD_PIPELINE_STAGES_ENABLEASG_ALICLOUDENABLEASGSTAGE } from './pipeline/stages/enableAsg/alicloudEnableAsgStage';
import { ALICLOUD_PIPELINE_STAGES_FINDAMI_ALICLOUDFINDAMISTAGE } from './pipeline/stages/findAmi/alicloudFindAmiStage';
import { ALICLOUD_PIPELINE_STAGES_FINDIMAGEFROMTAGS_ALICLOUDFINDIMAGEFROMTAGSSTAGE } from './pipeline/stages/findImageFromTags/alicloudFindImageFromTagsStage';
import { ALICLOUD_PIPELINE_STAGES_RESIZEASG_ALICLOUDRESIZEASGSTAGE } from './pipeline/stages/resizeAsg/alicloudResizeAsgStage';
import { ALICLOUD_PIPELINE_STAGES_ROLLBACKCLUSTER_ALICLOUDROLLBACKCLUSTERSTAGE } from './pipeline/stages/rollbackCluster/alicloudRollbackClusterStage';

import { ALICLOUD_PIPELINE_STAGES_SCALEDOWNCLUSTER_ALICLOUDSCALEDOWNCLUSTERSTAGE } from './pipeline/stages/scaleDownCluster/alicloudScaleDownClusterStage';
import { ALICLOUD_PIPELINE_STAGES_TAGIMAGE_ALICLOUDTAGIMAGESTAGE } from './pipeline/stages/tagImage/alicloudTagImageStage';
import { ALICLOUD_SECURITY_CREATECTRL } from './securityGroup/configure/CreateSecurityGroupCtrl';
import { ALICLOUD_SECURITY_EDITCTRL } from './securityGroup/configure/EditSecurityGroupCtrl';
import { ALICLOUD_SECURITY_DETAILCTRL } from './securityGroup/details/securityGroupDetail.controller';
import { ALICLOUD_SECURITY_READER } from './securityGroup/securityGroup.reader';
import { ALICLOUD_SECURITY_TRANSFORMER } from './securityGroup/securityGroup.transformer';
import { ALICLOUD_SECURITY_WRITE_SERVICE } from './securityGroup/securityGroup.write.service';
import { ALICLOUD_SERVERGROUP_CONFIGURE } from './serverGroup/configure/serverGroup.configure.alicloud.module';
import { ALICLOUD_CLONESERVERGROUPCTRL } from './serverGroup/configure/wizard/CloneServerGroup.alicloud.controller';
import { ALICLOUD_SERVERGROUP_DETAILS } from './serverGroup/details/serverGroup.details.module';
import { ALICLOUD_SERVERGROUP_TRANSFORMER } from './serverGroup/serverGroup.transformer';
import { ALICLOU_VALIDATION } from './validation/applicationName.validator';

import './logo/alicloud.logo.less';

// load all templates into the $templateCache
const templates = require.context('./', true, /\.html$/);
templates.keys().forEach(function (key) {
  templates(key);
});

export const ALICLOUD_MODULE = 'spinnaker.alicloud';
module(ALICLOUD_MODULE, [
  ALICLOUD_PIPELINE_STAGES_BAKE_ALICLOUDBAKESTAGE,
  ALICLOUD_PIPELINE_STAGES_DESTROYASG_ALICLOUDDESTROYASGSTAGE,
  ALICLOUD_PIPELINE_STAGES_ENABLEASG_ALICLOUDENABLEASGSTAGE,
  ALICLOUD_PIPELINE_STAGES_FINDAMI_ALICLOUDFINDAMISTAGE,
  ALICLOUD_PIPELINE_STAGES_SCALEDOWNCLUSTER_ALICLOUDSCALEDOWNCLUSTERSTAGE,
  ALICLOUD_PIPELINE_STAGES_ROLLBACKCLUSTER_ALICLOUDROLLBACKCLUSTERSTAGE,
  ALICLOUD_PIPELINE_STAGES_RESIZEASG_ALICLOUDRESIZEASGSTAGE,
  ALICLOUD_PIPELINE_STAGES_FINDIMAGEFROMTAGS_ALICLOUDFINDIMAGEFROMTAGSSTAGE,
  ALICLOUD_PIPELINE_STAGES_TAGIMAGE_ALICLOUDTAGIMAGESTAGE,
  ALICLOUD_PIPELINE_STAGES_DISABLECLUSTER_ALICLOUDDISABLECLUSTERSTAGE,
  ALICLOUD_PIPELINE_STAGES_CLONESERVERGROUP_ALICLOUDCLONESERVERGROUPSTAGE,

  ALICLOUD_SECURITY_READER,
  ALICLOUD_SECURITY_TRANSFORMER,
  ALICLOUD_SECURITY_DETAILCTRL,
  ALICLOUD_SECURITY_CREATECTRL,
  ALICLOUD_SECURITY_EDITCTRL,
  ALICLOUD_SECURITY_WRITE_SERVICE,

  ALICLOUD_SERVERGROUP_DETAILS,
  ALICLOUD_SERVERGROUP_TRANSFORMER,
  ALICLOUD_CLONESERVERGROUPCTRL,
  ALICLOUD_SERVERGROUP_CONFIGURE,

  ALICLOUD_INSTANCE_SERVICE,
  ALICLOUD_INSTANCE_DETAILCTRL,

  ALICLOUD_LOADBALANCER_BALANCER,
  ALICLOUD_LOADBALANCER_DETAILS,
  ALICLOUD_LOADBALANCER_CREATE,

  ALICLOUD_IMAGE,
  ALICLOU_VALIDATION,
]).config(function () {
  CloudProviderRegistry.registerProvider('alicloud', {
    name: 'AlibabaCloud',
    logo: {
      path: alicloudlogo,
    },
    image: {
      reader: 'alicloudImageReader',
    },
    serverGroup: {
      transformer: 'alicloudServerGroupTransformer',
      detailsTemplateUrl: require('./serverGroup/details/serverGroupDetails.html'),
      detailsController: 'alicloudServerGroupDetailsCtrl',
      // CloneServerGroupModal: CloneServerGroupAlicloud,
      cloneServerGroupTemplateUrl: require('./serverGroup/configure/wizard/serverGroupWizard.html'),
      cloneServerGroupController: 'alicloudCloneServerGroupCtrl',
      commandBuilder: 'alicloudServerGroupCommandBuilder',
      configurationService: 'alicloudServerGroupConfigurationService',
    },
    instance: {
      instanceTypeService: 'alicloudInstanceTypeService',
      detailsTemplateUrl: require('./instance/details/instanceDetails.html'),
      detailsController: 'alicloudInstanceDetailsCtrl',
    },
    securityGroup: {
      transformer: 'alicloudSecurityGroupTransformer',
      writer: 'alicloudSecurityGroupWriter',
      reader: 'alicloudSecurityGroupReader',
      detailsTemplateUrl: require('./securityGroup/details/securityGroupDetail.html'),
      detailsController: 'alicloudSecurityGroupDetailsCtrl',
      // CreateSecurityGroupModal: CreateSecurityGroup,
      createSecurityGroupTemplateUrl: require('./securityGroup/configure/createSecurityGroup.html'),
      createSecurityGroupController: 'alicloudCreateSecurityGroupCtrl',
    },
    loadBalancer: {
      transformer: 'alicloudLoadBalancerTransformer',
      detailsTemplateUrl: require('./loadBalancer/details/loadBalancerDetail.html'),
      detailsController: 'alicloudLoadBalancerDetailsCtrl',
      // CreateLoadBalancerModal: ConfigureLoadBalancerModal,
      createLoadBalancerTemplateUrl: require('./loadBalancer/configure/createLoadBalancer.html'),
      createLoadBalancerController: 'alicloudCreateLoadBalancerCtrl',
    },
  });
});

DeploymentStrategyRegistry.registerProvider('alicloud', ['custom', 'redblack', 'rollingpush', 'rollingredblack']);
