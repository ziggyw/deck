'use strict';

const angular = require('angular');

import { AccountService, Registry } from '@spinnaker/core';

export const ALICLOUD_PIPELINE_STAGES_DISABLECLUSTER_ALICLOUDDISABLECLUSTERSTAGE =
  'spinnaker.alicloud.pipeline.stage.alicloud.disableClusterStage';
export const name = ALICLOUD_PIPELINE_STAGES_DISABLECLUSTER_ALICLOUDDISABLECLUSTERSTAGE; // for backwards compatibility
angular
  .module(ALICLOUD_PIPELINE_STAGES_DISABLECLUSTER_ALICLOUDDISABLECLUSTERSTAGE, [])
  .config(function () {
    Registry.pipeline.registerStage({
      provides: 'disableCluster',
      cloudProvider: 'alicloud',
      templateUrl: require('./disableClusterStage.html'),
      validators: [
        { type: 'requiredField', fieldName: 'cluster' },
        {
          type: 'requiredField',
          fieldName: 'remainingEnabledServerGroups',
          fieldLabel: 'Keep [X] enabled Server Groups',
        },
        { type: 'requiredField', fieldName: 'regions' },
        { type: 'requiredField', fieldName: 'credentials', fieldLabel: 'account' },
      ],
    });
  })
  .controller('alicloudDisableClusterStageCtrl', [
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

      if (stage.remainingEnabledServerGroups === undefined) {
        stage.remainingEnabledServerGroups = 1;
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
