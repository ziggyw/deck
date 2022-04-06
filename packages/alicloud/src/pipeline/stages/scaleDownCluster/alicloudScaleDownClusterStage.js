'use strict';

import { AccountService, ExecutionDetailsTasks, Registry } from '@spinnaker/core';

import { ScaleDownClusterExecutionDetails } from './ScalDown';

const angular = require('angular');

export const ALICLOUD_PIPELINE_STAGES_SCALEDOWNCLUSTER_ALICLOUDSCALEDOWNCLUSTERSTAGE =
  'spinnaker.alicloud.pipeline.stage.scaleDownClusterStage';
export const name = ALICLOUD_PIPELINE_STAGES_SCALEDOWNCLUSTER_ALICLOUDSCALEDOWNCLUSTERSTAGE; // for backwards compatibility
angular
  .module(ALICLOUD_PIPELINE_STAGES_SCALEDOWNCLUSTER_ALICLOUDSCALEDOWNCLUSTERSTAGE, [])
  .config(function () {
    Registry.pipeline.registerStage({
      executionDetailsSections: [ScaleDownClusterExecutionDetails, ExecutionDetailsTasks],
      useBaseProvider: true,
      key: 'scaleDownCluster',
      label: 'Scale Down Cluster',
      description: 'Scales down a cluster',
      provides: 'scaleDownCluster',
      cloudProvider: 'alicloud',
      templateUrl: require('./scaleDownClusterStage.html'),
      accountExtractor: (stage) => [stage.context.credentials],
      configAccountExtractor: (stage) => [stage.credentials],
      validators: [
        { type: 'requiredField', fieldName: 'cluster' },
        {
          type: 'requiredField',
          fieldName: 'remainingFullSizeServerGroups',
          fieldLabel: 'Keep [X] full size Server Groups',
        },
        { type: 'requiredField', fieldName: 'regions' },
        { type: 'requiredField', fieldName: 'credentials', fieldLabel: 'account' },
      ],
      strategy: true,
    });
  })
  .controller('alicloudScaleDownClusterStageCtrl', [
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

      stage.regions = stage.regions || [];
      stage.cloudProvider = 'alicloud';

      if (!stage.credentials && $scope.application.defaultCredentials.alicloud) {
        stage.credentials = $scope.application.defaultCredentials.alicloud;
      }
      if (!stage.regions.length && $scope.application.defaultRegions.alicloud) {
        stage.regions.push($scope.application.defaultRegions.alicloud);
      }

      if (stage.remainingFullSizeServerGroups === undefined) {
        stage.remainingFullSizeServerGroups = 1;
      }

      if (stage.allowScaleDownActive === undefined) {
        stage.allowScaleDownActive = false;
      }

      ctrl.pluralize = function (str, val) {
        if (val === 1) {
          return str;
        }
        return str + 's';
      };

      if (stage.preferLargerOverNewer === undefined) {
        stage.preferLargerOverNewer = 'false';
      }
      stage.preferLargerOverNewer = stage.preferLargerOverNewer.toString();
    },
  ]);
