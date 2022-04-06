'use strict';

const angular = require('angular');
export const ALICLOUD_FOOTER_DIRECTIVE = 'spinnaker.alicloud.footer.directive';
export const name = ALICLOUD_FOOTER_DIRECTIVE;

angular.module(ALICLOUD_FOOTER_DIRECTIVE, []).directive('alicloudFooter', function () {
  return {
    restrict: 'E',
    templateUrl: require('./footer.directive.html'),
    scope: {},
    bindToController: {
      action: '&',
      isValid: '&',
      cancel: '&',
      account: '=?',
      verification: '=?',
    },
    controllerAs: 'vm',
    controller: angular.noop,
  };
});
