'use strict';

import Utility from '../../../../utility';

const angular = require('angular');

export const ALICLOUD_SERVERGROUP_TAGS = 'spinnaker.alicloud.serverGroup.configure.wizard.tags.directive';
angular
  .module(ALICLOUD_SERVERGROUP_TAGS, [])
  .directive('alicloudTagsSelector', function () {
    return {
      restrict: 'E',
      templateUrl: require('./tagsSelector.directive.html'),
      scope: {},
      bindToController: {
        command: '=',
      },
      controllerAs: 'tagsSelectorCtrl',
      controller: 'TagsSelectorCtrl',
    };
  })
  .controller('TagsSelectorCtrl', [
    '$scope',
    function () {
      this.getTagResult = function () {
        if (this.command.scalingConfigurations) {
          return Utility.checkTags(this.command.scalingConfigurations.tags);
        } else {
          return Utility.checkTags(this.command.instanceTags);
        }
      };
    },
  ]);
