import type { ILoadBalancerUpsertCommand } from '@spinnaker/core';

export interface IALBListenerCertificate {
  certificateArn: string;
  type: string;
  name: string;
}

export interface IAlicloudLoadBalancerUpsertCommand extends ILoadBalancerUpsertCommand {
  availabilityZones: { [region: string]: string[] };
  isInternal: boolean;
  listeners: any[];
  loadBalancerType?: 'classic' | 'application';
  regionZones: string[];
  securityGroups: string[];
  subnetType: string;
  usePreferredZones?: boolean;
  vpcId: string;
}

export interface IRedirectActionConfig {
  host?: string;
  path?: string;
  port?: string;
  protocol?: 'HTTP' | 'HTTPS' | '#{protocol}';
  query?: string;
  httpCode: string;
}
