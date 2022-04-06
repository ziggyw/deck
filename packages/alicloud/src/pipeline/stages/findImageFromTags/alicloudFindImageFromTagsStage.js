'use strict';

const angular = require('angular');

import { BakeryReader, Registry } from '@spinnaker/core';

export const ALICLOUD_PIPELINE_STAGES_FINDIMAGEFROMTAGS_ALICLOUDFINDIMAGEFROMTAGSSTAGE =
  'spinnaker.alicloud.pipeline.stage.alicloud.findImageFromTagsStage';
export const name = ALICLOUD_PIPELINE_STAGES_FINDIMAGEFROMTAGS_ALICLOUDFINDIMAGEFROMTAGSSTAGE; // for backwards compatibility
angular
  .module(ALICLOUD_PIPELINE_STAGES_FINDIMAGEFROMTAGS_ALICLOUDFINDIMAGEFROMTAGSSTAGE, [])
  .config(function () {
    Registry.pipeline.registerStage({
      provides: 'findImageFromTags',
      cloudProvider: 'alicloud',
      templateUrl: require('./findImageFromTagsStage.html'),
      executionDetailsUrl: require('./findImageFromTagsExecutionDetails.html'),
      executionConfigSections: ['findImageConfig', 'taskStatus'],
      validators: [
        { type: 'requiredField', fieldName: 'packageName' },
        { type: 'requiredField', fieldName: 'regions' },
        { type: 'requiredField', fieldName: 'tags' },
      ],
    });
  })
  .controller('alicloudFindImageFromTagsStageCtrl', [
    '$scope',
    function ($scope) {
      $scope.stage.tags = $scope.stage.tags || {};
      $scope.stage.regions = $scope.stage.regions || [];
      $scope.stage.cloudProvider = $scope.stage.cloudProvider || 'alicloud';

      BakeryReader.getRegions('alicloud').then(function (regions) {
        $scope.regions = regions;
      });
    },
  ]);
