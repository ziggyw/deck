'use strict';

const angular = require('angular');

import { AccountService, Registry } from '@spinnaker/core';

export const ALICLOUD_PIPELINE_STAGES_ROLLBACKCLUSTER_ALICLOUDROLLBACKCLUSTERSTAGE =
  'spinnaker.alicloud.pipeline.stage.rollbackClusterStage';
export const name = ALICLOUD_PIPELINE_STAGES_ROLLBACKCLUSTER_ALICLOUDROLLBACKCLUSTERSTAGE; // for backwards compatibility
angular
  .module(ALICLOUD_PIPELINE_STAGES_ROLLBACKCLUSTER_ALICLOUDROLLBACKCLUSTERSTAGE, [])
  .config(function () {
    Registry.pipeline.registerStage({
      provides: 'rollbackCluster',
      cloudProvider: 'alicloud',
      templateUrl: require('./rollbackClusterStage.html'),
      validators: [
        { type: 'requiredField', fieldName: 'cluster' },
        { type: 'requiredField', fieldName: 'regions' },
        { type: 'requiredField', fieldName: 'credentials', fieldLabel: 'account' },
      ],
    });
  })
  .controller('alicloudRollbackClusterStageCtrl', [
    '$scope',
    function ($scope) {
      var ctrl = this;

      let stage = $scope.stage;

      $scope.state = {
        accounts: false,
        regionsLoaded: false,
      };

      AccountService.listAccounts('alicloud').then(function (accounts) {
        $scope.accounts = accounts;
        $scope.state.accounts = true;
      });

      ctrl.reset = () => {
        ctrl.accountUpdated();
        ctrl.resetSelectedCluster();
      };

      stage.regions = stage.regions || [];
      stage.cloudProvider = 'alicloud';
      stage.targetHealthyRollbackPercentage = stage.targetHealthyRollbackPercentage || 100;

      if (
        stage.isNew &&
        $scope.application.attributes.platformHealthOnlyShowOverride &&
        $scope.application.attributes.platformHealthOnly
      ) {
        stage.interestingHealthProviderNames = ['AlibabaCloud'];
      }

      if (!stage.credentials && $scope.application.defaultCredentials.alicloud) {
        stage.credentials = $scope.application.defaultCredentials.alicloud;
      }
      if (!stage.regions.length && $scope.application.defaultRegions.alicloud) {
        stage.regions.push($scope.application.defaultRegions.alicloud);
      }
    },
  ]);
