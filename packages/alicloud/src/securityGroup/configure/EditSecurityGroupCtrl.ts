'use strict';

import { default as UIROUTER_ANGULARJS } from '@uirouter/angularjs';
import * as _ from 'lodash';

import {
  AccountService,
  CACHE_INITIALIZER_SERVICE,
  FirewallLabels,
  InfrastructureCaches,
  REST,
  SECURITY_GROUP_READER,
  TaskMonitor,
} from '@spinnaker/core';

import { ALICLOUD_SECURITY_WRITE_SERVICE } from '../securityGroup.write.service';

const angular = require('angular');

export const ALICLOUD_SECURITY_EDITCTRL = 'spinnaker.alicloud.securityGroup.alicloud.edit.controller';
angular
  .module(ALICLOUD_SECURITY_EDITCTRL, [
    UIROUTER_ANGULARJS,
    CACHE_INITIALIZER_SERVICE,
    SECURITY_GROUP_READER,
    ALICLOUD_SECURITY_WRITE_SERVICE,
  ])
  .controller('alicloudEditSecurityGroupCtrl', [
    '$scope',
    '$uibModalInstance',
    '$exceptionHandler',
    '$state',
    'securityGroupReader',
    'cacheInitializer',
    'application',
    'securityGroup',
    'alicloudSecurityGroupWriter',
    // eslint-disable-next-line @spinnaker/ng-strictdi
    function (
      $scope: any,
      $uibModalInstance: any,
      _$exceptionHandler: any,
      $state: any,
      securityGroupReader: any,
      cacheInitializer: any,
      application: any,
      securityGroup: any,
      alicloudSecurityGroupWriter: any,
    ) {
      $scope.pages = {
        location: require('./createSecurityGroupProperties.html'),
        ingress: require('./createSecurityGroupIngress.html'),
      };
      const that = this;

      this.accountUpdated = function () {
        AccountService.getRegionsForAccount($scope.securityGroup.credentials).then(function (regions: any) {
          const region: any[] = [];
          regions.forEach((item: any): void => {
            region.push({ name: item });
          });
          $scope.regions = region;
          that.updateName();
          that.regionUpdated();
        });
      };

      AccountService.listAccounts('alicloud').then(function (accounts: any) {
        $scope.accounts = accounts;
        that.accountUpdated();
      });
      $scope.regions = [];
      securityGroup.securityGroupIngress = _.map(securityGroup.inboundRules, function (rule: any) {
        const ingress: any = {};
        if (!_.isEmpty(rule.permissions.portRange)) {
          ingress.startPortRange = Number(rule.permissions.portRange.split('/')[0]);
          ingress.endPortRange = Number(rule.permissions.portRange.split('/')[1]);
          ingress.portRange = ingress.startPortRange + '/' + ingress.endPortRange;
        }
        ingress.ipProtocol = rule.permissions.ipProtocol.toLowerCase();
        ingress.sourceCidrIp = rule.permissions.sourceCidrIp;
        return ingress;
      });

      this.updateName = function () {
        const securityGroups: any = $scope.securityGroup;
        let name: string = application.name;
        if (securityGroups.detail) {
          name += '-' + securityGroups.stack + '-' + securityGroups.detail;
        }
        securityGroups.name = name;
        $scope.namePreview = name;
      };

      this.regionUpdated = function () {
        this.vnetUpdated();
      };

      this.selectedSubnetChanged = function (subnet: any) {
        $scope.securityGroup.vpcName = subnet.vpcName;
        $scope.securityGroup.vpcId = subnet.vpcId;
        $scope.securityGroup.vswitchId = subnet.vswitchId;
      };

      this.vnetUpdated = function () {
        const account = $scope.securityGroup.credentials;
        const region = $scope.securityGroup.region;
        $scope.securityGroup.selectedVnet = null;
        $scope.securityGroup.vnet = null;
        $scope.securityGroup.vnetResourceGroup = null;
        this.selectedVnets = [];
        REST('/subnets/alicloud')
          .get()
          .then((vnets: any) => {
            vnets.forEach((vnet: any) => {
              if (vnet.account === account && vnet.region === region) {
                this.selectedVnets.push(vnet);
              }
            });
          });
        this.subnetUpdated();
      };

      this.subnetUpdated = function () {
        $scope.securityGroup.selectedSubnet = null;
        $scope.securityGroup.subnet = null;
        this.selectedSubnets = [];
      };

      $scope.securityGroup = securityGroup;
      $scope.state = {
        refreshingSecurityGroups: false,
      };

      this.maxSizePattern = function (rule: any) {
        if (rule.endPortRange) {
          if (rule.startPortRange >= rule.endPortRange) {
            rule.startPortRange = null;
          }
        }
      };

      this.selectedSubnetChanged = function (subnet: any) {
        $scope.securityGroup.vpcName = subnet.vpcName;
        $scope.securityGroup.vpcId = subnet.vpcId;
        $scope.securityGroup.vswitchId = subnet.vswitchId;
      };

      this.minSizePattern = function (rule: any) {
        if (rule.startPortRange) {
          if (rule.startPortRange >= rule.endPortRange) {
            rule.endPortRange = null;
          }
        }
      };

      $scope.taskMonitor = new TaskMonitor({
        application: application,
        title: `Updating your ${FirewallLabels.get('firewall')}`,
        modalInstance: $uibModalInstance,
        onTaskComplete: onTaskComplete,
      });

      this.getSecurityGroupRefreshTime = function () {
        return InfrastructureCaches.get('securityGroups').getStats().ageMax;
      };

      this.refreshSecurityGroups = function () {
        $scope.state.refreshingSecurityGroups = true;
        return cacheInitializer.refreshCache('securityGroups').then(function () {
          initializeSecurityGroups().then(function () {
            $scope.state.refreshingSecurityGroups = false;
          });
        });
      };

      function initializeSecurityGroups() {
        return securityGroupReader.getAllSecurityGroups().then(function (securityGroups: any) {
          const account = securityGroup.accountName;
          const region = securityGroup.region;
          const availableGroups = _.filter(securityGroups[account].alicloud[region], {});
          $scope.availableSecurityGroups = _.map(availableGroups, 'name');
        });
      }

      this.addRule = function (ruleset: any) {
        ruleset.push({
          ipProtocol: 'tcp',
          portRange: '',
          sourceCidrIp: '',
        });
      };

      function onApplicationRefresh() {
        if ($scope.$$destroyed) {
          return;
        }
        $uibModalInstance.close();
        const newStateParams = {
          name: $scope.securityGroup.name,
          accountId: $scope.securityGroup.credentials || $scope.securityGroup.accountName,
          region: $scope.securityGroup.region,
          provider: 'alicloud',
        };
        if (!$state.includes('**.firewallDetails')) {
          $state.go('.firewallDetails', newStateParams);
        } else {
          $state.go('^.firewallDetails', newStateParams);
        }
      }

      function onTaskComplete() {
        application.securityGroups.refresh();
        application.securityGroups.onNextRefresh($scope, onApplicationRefresh);
      }

      this.portUpdated = function (ruleset: any, index: number) {
        if (!_.isEmpty(ruleset[index].sourceIPCIDRRanges)) {
          const ruleRanges: any[] = ruleset[index].destPortRanges.split(',');
          if (ruleRanges.length > 1) {
            ruleset[index].destinationPortRanges = [];
            ruleRanges.forEach((v) => ruleset[index].destinationPortRanges.push(v));
            ruleset[index].destinationPortRange = null;
          } else {
            ruleset[index].destinationPortRange = ruleset[index].destPortRanges;
            ruleset[index].destinationPortRanges = [];
          }
        }
      };

      this.sourceIPCIDRUpdated = function (ruleset: any, index: number) {
        if (!_.isEmpty(ruleset[index].sourceIPCIDRRanges)) {
          const ruleRanges: any[] = ruleset[index].sourceIPCIDRRanges.split(',');
          if (ruleRanges.length > 1) {
            ruleset[index].sourceAddressPrefixes = [];
            ruleRanges.forEach((v: any) => ruleset[index].sourceAddressPrefixes.push(v));
            ruleset[index].sourceAddressPrefix = null;
          } else {
            ruleset[index].sourceAddressPrefix = ruleset[index].sourceIPCIDRRanges;
            ruleset[index].sourceAddressPrefixes = [];
          }
        }
      };

      this.removeRule = function (ruleset: any, index: number) {
        ruleset.splice(index, 1);
      };

      this.moveUp = function (ruleset: any, index: number) {
        if (index === 0) {
          return;
        }
        swapRules(ruleset, index, index - 1);
      };
      this.moveDown = function (ruleset: any, index: number) {
        if (index === ruleset.length - 1) {
          return;
        }
        swapRules(ruleset, index, index + 1);
      };

      function swapRules(ruleset: any, a: any, b: any) {
        const temp = ruleset[b];
        const priorityA = ruleset[a].priority;
        const priorityB = ruleset[b].priority;
        ruleset[b] = ruleset[a];
        ruleset[a] = temp;
        ruleset[a].priority = priorityA;
        ruleset[b].priority = priorityB;
      }

      $scope.taskMonitor.onTaskComplete = $uibModalInstance.dismiss;

      this.upsert = function () {
        $scope.taskMonitor.submit(function () {
          const params = {
            cloudProvider: 'alicloud',
            appName: application.name,
            credentials: $scope.securityGroup.accountName,
            regions: $scope.securityGroup.region.split(' '),
            vpcId: $scope.securityGroup.vpcId,
            securityGroupName: $scope.securityGroup.securityGroupName,
            description: $scope.securityGroup.description,
          };
          _($scope.securityGroup.securityGroupIngress).forEach((item: any) => {
            item.portRange = item.startPortRange + '/' + item.endPortRange;
          });
          const securityGroups = {
            securityGroupIngress: $scope.securityGroup.securityGroupIngress,
            type: 'upsertSecurityGroup',
            name: $scope.securityGroup.name,
          };
          return alicloudSecurityGroupWriter.upsertSecurityGroup(securityGroups, application, 'Update', params);
        });
      };

      this.cancel = function () {
        $uibModalInstance.dismiss();
      };
    },
  ]);
