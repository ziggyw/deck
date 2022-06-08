'use strict';

import { default as UIROUTER_ANGULARJS } from '@uirouter/angularjs';

import {
  ConfirmationModalService,
  FirewallLabels,
  LOAD_BALANCER_READ_SERVICE,
  LoadBalancerWriter,
  REST,
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
    // '$uibModal',
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
      // $uibModal: any,
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
        REST(`/loadBalancers/${loadBalancer.accountId}/${loadBalancer.region}/${loadBalancer.name}?provider=alicloud`)
          .get()
          .then((res) => {
            $scope.deleteParameters = res[0]?.results;

            // $scope.deleteParameters.cloudProvider = 'alicloud';
            $scope.deleteParameters.region = loadBalancer.region;
            $scope.deleteParameters.credentials = loadBalancer.accountId;
            $scope.deleteParameters.appName = loadBalancer.name;
          });
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
              $scope.loadBalancer.elb = details[0];
              $scope.showInClb = details[0].results.loadBalancerType === 'clb';
              $scope.showInAlb = details[0].results.loadBalancerType === 'alb';
              if ($scope.showInAlb) {
                const targetGroups = {} as any;
                $scope.loadBalancer.targetGroups.forEach((item: { serverGroupId: any; serverGroupName: any }) => {
                  targetGroups[item.serverGroupId] = item.serverGroupName;
                });
                $scope.loadBalancer.elb.results.listeners.forEach((item: any) => {
                  item.rules.forEach((r: any) => {
                    r.actions = r.ruleActions.map((rA: any) => {
                      const action: any = {
                        type: rA.type,
                      };
                      if (rA.type === 'ForwardGroup') {
                        action.forwardGroupConfig = {
                          serverGroupTuples: rA?.forwardGroupConfig?.serverGroupTuples.map((serverGroup: any) => {
                            const id = serverGroup.serverGroupId;
                            if (targetGroups[id]) {
                              serverGroup.serverGroupName = targetGroups[id];
                            }
                            return serverGroup;
                          }),
                        };
                      }
                      if (rA.type === 'redirectConfig') {
                        action.redirectConfig = rA?.redirectConfig;
                      }
                      return action;
                    });
                    r.priority = null;
                    r.conditions = r.ruleConditions.map((rD: any) => {
                      const condition: any = {
                        type: rD.type,
                      };
                      for (const [k, v] of Object.entries(rD)) {
                        if (Object.values(v)[0].length !== 0 && k !== 'type') {
                          condition.values = Object.values(v)[0];
                        }
                      }
                      return condition;
                    });
                  });
                });
              }
              $scope.showInAlb &&
                ($scope.subnets = details[0].results?.zoneMappings?.map((item: { vswitchId: any }) => item.vswitchId));
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
        const LoadBalancerModal = LoadBalancerTypes.find(
          (t) => t.sublabel === $scope.loadBalancer.loadBalancerType.toUpperCase(),
        ).component;
        //@ts-ignore
        LoadBalancerModal.show({ application: app, loadBalancer: $scope.loadBalancer });

        // $uibModal.open({
        //   templateUrl: require('../configure/editLoadBalancer.html'),
        //   controller: 'alicloudCreateLoadBalancerCtrl as ctrl',
        //   size: 'lg',
        //   resolve: {
        //     application: function () {
        //       return app;
        //     },
        //     loadBalancer: function () {
        //       return angular.copy($scope.loadBalancer);
        //     },
        //     isNew: function () {
        //       return false;
        //     },
        //   },
        // });
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

        const submitMethod = () =>
          LoadBalancerWriter.deleteLoadBalancer(
            $scope.showInAlb ? { ...$scope.deleteParameters, cloudProvider: 'alicloud' } : command,
            app,
          );
        // const submitMethod = () => LoadBalancerWriter.deleteLoadBalancer($scope.deleteParameters, app);
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
