'use strict';
import type { IQService } from 'angular';
import { module } from 'angular';
import { cloneDeep } from 'lodash';

import { AliCloudProviderSettings } from '../alicloud.settings';

export class AlicloudLoadBalancerTransformer {
  public static $inject = ['$q'];
  constructor(private $q: IQService) {}
  public normalizeLoadBalancer(loadBalancer: any): any {
    loadBalancer.serverGroups.forEach(function (serverGroup: any) {
      serverGroup.account = loadBalancer.account;
      serverGroup.region = loadBalancer.region;
      if (serverGroup.detachedInstances) {
        serverGroup.detachedInstances = serverGroup.detachedInstances.map(function (instanceId: any) {
          return { id: instanceId };
        });
        serverGroup.instances = serverGroup.instances?.concat(serverGroup.detachedInstances);
      } else {
        serverGroup.detachedInstances = [];
      }
      serverGroup.instances.forEach((item: any) => {
        item.provider = serverGroup.cloudProvider;
        item.healthState = item.health.state
          ? item.health.state === 'healthy'
            ? 'Up'
            : item.health.state === 'unknown'
            ? 'Unknown'
            : 'Down'
          : 'Down';
      });
    });
    loadBalancer.provider = loadBalancer.type;
    return this.$q.resolve(loadBalancer);
  }

  public convertLoadBalancerForEditing(loadBalancer: any) {
    const toEdit: any = {
      region: loadBalancer.region,
      credentials: loadBalancer.account,
      name: loadBalancer.name,
      stack: loadBalancer.stack,
      detail: loadBalancer.detail,
      vnet: loadBalancer.vnet,
      masterZoneId: loadBalancer.masterZoneId,
      address: loadBalancer.elb.results.attributes.address,
      addressIPVersion: loadBalancer.elb.results.attributes.addressIPVersion,
      addressType: loadBalancer.elb.results.attributes.addressType,
      deleteProtection: loadBalancer.elb.results.attributes.deleteProtection,
      loadBalancerSpec: loadBalancer.elb.results.attributes.loadBalancerSpec,
      vSwitchId: loadBalancer.elb.results.vswitchId,
      vSwitchName: loadBalancer.elb.results.vswitchName || '',
      subnet: loadBalancer.subnet,
      probes: [],
      loadBalancingRules: [],
      listenerPortsAndProtocal: loadBalancer.elb.results.attributes.listenerPortsAndProtocal,
      listeners: loadBalancer.elb.results.attributes.listenerPortsAndProtocal,
    };
    if (loadBalancer.elb) {
      const elb: any = loadBalancer.elb;
      toEdit.securityGroups = elb.securityGroups;
      toEdit.vnet = elb.vnet;
      toEdit.probes = elb.probes;
    }
    return toEdit;
  }

  public constructNewLoadBalancerTemplate(application: any) {
    const defaultCredentials: string =
      application.defaultCredentials.alicloud || AliCloudProviderSettings.defaults.account;
    const defaultRegion: string = application.defaultRegions.alicloud || AliCloudProviderSettings.defaults.region;
    return {
      stack: '',
      detail: 'frontend',
      credentials: defaultCredentials,
      region: defaultRegion,
      cloudProvider: 'alicloud',
      vnet: '',
      subnetId: '',
      masterZoneId: '',
      vSwitchId: '',
      vSwitchName: '',
      address: '',
      addressIPVersion: 'ipv4',
      addressType: 'intranet',
      deleteProtection: 'on',
      loadBalancerSpec: 'slb.s1.small',
      probes: [
        {
          probeName: '',
          probeProtocol: 'HTTP',
          probePort: 'www.bing.com',
          probePath: '/',
          probeInterval: 30,
          unhealthyThreshold: 8,
          timeout: 120,
        },
      ],
      listeners: [
        {
          listenerProtocol: 'HTTP',
          healthCheck: 'on',
          healthCheckTimeout: 5,
          unhealthyThreshold: 4,
          healthyThreshold: 4,
          healthCheckInterval: 2,
          healthCheckURI: '',
          listenerPort: 80,
          bandwidth: -1,
          stickySession: 'on',
          backendServerPort: 80,
          gzip: 'on',
          stickySessionType: 'server',
          cookie: '',
          cookieTimeout: 500,
          scheduler: 'wrr',
          requestTimeout: 60,
          idleTimeout: 15,
          healthCheckHttpCode: 'http_2xx',
        },
      ],
      loadBalancingRules: [
        {
          ruleName: '',
          protocol: 'HTTP',
          externalPort: 80,
          backendPort: 80,
          probeName: '',
          persistence: 'None',
          idleTimeout: 4,
        },
      ],
    };
  }
  public convertApplicationLoadBalancerForEditing(loadBalancer: any) {
    const targetGroups = {} as any;
    const loadBalancerEdit = cloneDeep(loadBalancer);
    loadBalancerEdit.targetGroups.forEach((item: { serverGroupId: any; serverGroupName: any }) => {
      targetGroups[item.serverGroupId] = item.serverGroupName;
    });
    loadBalancerEdit.elb.results.listeners.forEach((item: { defaultActions: any }) => {
      const id = item.defaultActions[0].forwardGroupConfig.serverGroupTuples[0].serverGroupId;
      if (targetGroups[id]) {
        item.defaultActions[0].serverGroupName = targetGroups[id];
      }
    });
    // loadBalancerEdit.elb.results.listeners.forEach((item: any) => {
    //   item.rules.forEach((r: any) => {
    //     r.actions = r.ruleActions.map((rA: any) => {
    //       const action: any = {
    //         type: rA.type,
    //       };
    //       if (rA.type === 'ForwardGroup') {
    //         action.forwardGroupConfig = {
    //           serverGroupTuples: rA?.forwardGroupConfig?.serverGroupTuples.map((serverGroup: any) => {
    //             const id = serverGroup.serverGroupId;
    //             if (targetGroups[id]) {
    //               serverGroup.serverGroupName = targetGroups[id];
    //             }
    //             return serverGroup;
    //           }),
    //         };
    //       }
    //       if (rA.type === 'redirectConfig') {
    //         action.redirectConfig = rA?.redirectConfig;
    //       }
    //       return action;
    //     });
    //     r.priority = null;
    //     r.conditions = r.ruleConditions.map((rD: any) => {
    //       const condition: any = {
    //         type: rD.type,
    //       };
    //       for (const [k, v] of Object.entries(rD)) {
    //         if (Object.values(v)[0].length !== 0 && k !== 'type') {
    //           condition.values = Object.values(v)[0];
    //         }
    //       }
    //       return condition;
    //     });
    //   });
    // });

    return {
      credentials: loadBalancerEdit.account,
      stack: loadBalancerEdit.stack,
      detail: loadBalancerEdit.detail,
      loadBalancerType: 'ALB',
      loadBalancerName: loadBalancerEdit.name,
      addressType: loadBalancerEdit.elb.results.addressType,
      addressAllocatedMode: loadBalancerEdit.elb.results.addressAllocatedMode,
      vpcId: loadBalancerEdit.elb.results.vpcId,
      // @ts-ignore
      zoneMappings: loadBalancerEdit.elb.results.zoneMappings,
      targetServerGroups: loadBalancerEdit.elb.results.targetServerGroups.map((target: { attributes: any }) => {
        target.attributes.protocol = target.attributes.bizProtocol;
        return target.attributes;
      }),

      listeners: loadBalancerEdit.elb.results.listeners,
      region: loadBalancerEdit.region,
    };
  }

  public constructNewApplicationLoadBalancerTemplate(application: any) {
    const defaultRegion: string = application.defaultRegions.alicloud || AliCloudProviderSettings.defaults.region;
    const defaultTargetGroupName = `servergroup`;
    return {
      stack: '',
      detail: 'frontend',
      loadBalancerType: 'ALB',
      loadBalancerName: '',
      addressType: 'Intranet',
      addressAllocatedMode: 'Dynamic',
      vpcId: '',
      // @ts-ignore
      zoneMappings: [],
      targetServerGroups: [
        {
          serverGroupName: defaultTargetGroupName,
          protocol: 'HTTP',
          Scheduler: 'Wrr',
          serverGroupType: 'Instance',
          healthCheckConfig: {
            healthCheckConnectPort: 80,
            healthCheckEnabled: true,
            healthCheckPath: '/healthcheck',
            healthCheckTimeout: 5,
            healthCheckInterval: 10,
            healthyThreshold: 10,
            unhealthyThreshold: 2,
          },
          stickySessionConfig: {
            stickySessionEnabled: true,
            stickySessionType: 'Insert',
            cookieTimeout: 300,
          },
        },
      ],

      listeners: [
        {
          listenerProtocol: 'HTTP',
          // @ts-ignore
          certificates: [],
          listenerPort: 80,
          defaultActions: [
            {
              type: 'ForwardGroup',
              serverGroupName: defaultTargetGroupName,
            },
          ],
          // @ts-ignore
          rules: [],
        },
      ],
      region: defaultRegion,
    };
  }
}

export const ALICLOUD_LOADBALANCER_BALANCER = 'spinnaker.alicloud.loadBalancer.transformer';
module(ALICLOUD_LOADBALANCER_BALANCER, []).service('alicloudLoadBalancerTransformer', AlicloudLoadBalancerTransformer);
