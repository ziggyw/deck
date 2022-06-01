'use strict';

import { default as UIROUTER_ANGULARJS } from '@uirouter/angularjs';

import {
  ConfirmationModalService,
  FirewallLabels,
  /* A service that is used to read load balancer data. */
  LOAD_BALANCER_READ_SERVICE,
  LoadBalancerWriter,
  SECURITY_GROUP_READER,
} from '@spinnaker/core';
import type { ILoadBalancerDeleteCommand } from '@spinnaker/core';
import { LoadBalancerTypes } from '../configure/choiceModal/LoadBalancerTypes';
const angular = require('angular');

export const ALICLOUD_LOADBALANCER_DETAILS = 'spinnaker.alicloud.loadBalancer.details.controller';
angular
  .module(ALICLOUD_LOADBALANCER_DETAILS, [UIROUTER_ANGULARJS, SECURITY_GROUP_READER, LOAD_BALANCER_READ_SERVICE])
  .controller('alicloudLoadBalancerDetailsCtrl', [
    '$scope',
    '$state',
    '$exceptionHandler',
    '$uibModal',
    'loadBalancer',
    'app',
    'securityGroupReader',
    'loadBalancerReader',
    '$q',
    // eslint-disable-next-line @spinnaker/ng-strictdi
    function (
      $scope: any,
      $state: any,
      _$exceptionHandler: any,
      $uibModal: any,
      loadBalancer: any,
      app: any,
      _securityGroupReader: any,
      loadBalancerReader: any,
      $q: any,
    ) {
      $scope.state = {
        loading: true,
      };

      $scope.firewallsLabel = FirewallLabels.get('Firewalls');

      function extractLoadBalancer() {
        $scope.loadBalancer = app.loadBalancers.data.filter(function (test: any) {
          return (
            test.name === loadBalancer.name &&
            test.region === loadBalancer.region &&
            test.account === loadBalancer.accountId
          );
        })[0];

        $scope.app = app;
        if ($scope.loadBalancer) {
          const detailsLoader = loadBalancerReader.getLoadBalancerDetails(
            $scope.loadBalancer.provider,
            loadBalancer.accountId,
            loadBalancer.region,
            loadBalancer.name,
          );

          return detailsLoader.then(function (details: any) {
            $scope.state.loading = false;

            if (details.length) {
              if (!(details[0].results.loadBalancerType === 'alb')) {
                $scope.showInClb = true;
              }
              $scope.subnets = details[0].results?.zoneMappings?.map((item: { vswitchId: any }) => item.vswitchId);

              $scope.loadBalancer.elb = details[0];
              $scope.showInAlb = details[0].results.loadBalancerType === 'alb';
              $scope.loadBalancer.account = loadBalancer.accountId;
            }
          });
        }
        if (!$scope.loadBalancer) {
          $state.go('^');
        }

        return $q.when(null);
      }

      app
        .ready()
        .then(extractLoadBalancer)
        .then(() => {
          if (!$scope.$$destroyed) {
            app.onRefresh($scope, extractLoadBalancer);
          }
        });

      this.editLoadBalancer = function editLoadBalancer() {
        if ($scope.loadBalancer.loadBalancerType === 'alb') {
          const LoadBalancerModal = LoadBalancerTypes.find(
            (t) => t.sublabel === $scope.loadBalancer.loadBalancerType.toUpperCase(),
          ).component;
          //@ts-ignore
          LoadBalancerModal.show({ application: app, loadBalancer: $scope.loadBalancer });
        } else {
          const LoadBalancerModal = LoadBalancerTypes.find((t) => t.sublabel === 'CLB').component;
          //@ts-ignore
          LoadBalancerModal.show({ application: app, loadBalancer: $scope.loadBalancer });
        }
        $uibModal.open({
          templateUrl: require('../configure/editLoadBalancer.html'),
          controller: 'alicloudCreateLoadBalancerCtrl as ctrl',
          size: 'lg',
          resolve: {
            application: function () {
              return app;
            },
            loadBalancer: function () {
              return angular.copy($scope.loadBalancer);
            },
            isNew: function () {
              return false;
            },
          },
        });
      };

      this.deleteLoadBalancer = function deleteLoadBalancer() {
        if ($scope.loadBalancer.instances && $scope.loadBalancer.instances.length) {
          return;
        }

        const taskMonitor = {
          application: app,
          title: 'Deleting ' + loadBalancer.name,
        };
        const command: ILoadBalancerDeleteCommand = {
          loadBalancerName: $scope.loadBalancer.name,
          loadBalancerId: $scope.loadBalancer.loadBalancerId,
          credentials: $scope.loadBalancer.account,
          region: loadBalancer.region,
          appName: app.name,
          cloudProvider: 'alicloud',
        };
        const submitMethod = () => LoadBalancerWriter.deleteLoadBalancer(command, app);
        ConfirmationModalService.confirm({
          header: 'Really delete ' + loadBalancer.name + '?',
          buttonText: 'Delete ' + loadBalancer.name,
          account: loadBalancer.accountId,
          taskMonitorConfig: taskMonitor,
          submitMethod: submitMethod,
        });
      };
    },
  ]);
