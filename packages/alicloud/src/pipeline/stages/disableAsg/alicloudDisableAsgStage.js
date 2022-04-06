'use strict';

const angular = require('angular');

import { AccountService, Registry, StageConstants } from '@spinnaker/core';

export const ALICLOUD_PIPELINE_STAGES_DISABLEASG_ALICLOUDDISABLEASGSTAGE =
  'spinnaker.alicloud.pipeline.stage.disableAsgStage';
export const name = ALICLOUD_PIPELINE_STAGES_DISABLEASG_ALICLOUDDISABLEASGSTAGE; // for backwards compatibility
angular
  .module(ALICLOUD_PIPELINE_STAGES_DISABLEASG_ALICLOUDDISABLEASGSTAGE, [])
  .config(function () {
    Registry.pipeline.registerStage({
      provides: 'disableServerGroup',
      alias: 'disableAsg',
      cloudProvider: 'alicloud',
      templateUrl: require('./disableAsgStage.html'),
      executionStepLabelUrl: require('./disableAsgStepLabel.html'),
      validators: [
        {
          type: 'targetImpedance',
          message:
            'This pipeline will attempt to disable a server group without deploying a new version into the same cluster.',
        },
        { type: 'requiredField', fieldName: 'cluster' },
        { type: 'requiredField', fieldName: 'target' },
        { type: 'requiredField', fieldName: 'regions' },
        { type: 'requiredField', fieldName: 'credentials', fieldLabel: 'account' },
      ],
    });
  })
  .controller('alicloudDisableAsgStageCtrl', [
    '$scope',
    function ($scope) {
      let stage = $scope.stage;

      $scope.state = {
        accounts: false,
        regionsLoaded: false,
      };

      AccountService.listAccounts('alicloud').then(function (accounts) {
        $scope.accounts = accounts;
        $scope.state.accounts = true;
      });

      $scope.targets = StageConstants.TARGET_LIST;

      stage.regions = stage.regions || [];
      stage.cloudProvider = 'alicloud';

      if (stage.isNew && $scope.application.attributes.platformHealthOnly) {
        stage.interestingHealthProviderNames = []; // bypass the check for now; will change this later to ['alicloudService']
      }

      if (!stage.credentials && $scope.application.defaultCredentials.alicloud) {
        stage.credentials = $scope.application.defaultCredentials.alicloud;
      }
      if (!stage.regions.length && $scope.application.defaultRegions.alicloud) {
        stage.regions.push($scope.application.defaultRegions.alicloud);
      }

      if (!stage.target) {
        stage.target = $scope.targets[0].val;
      }
    },
  ]);
