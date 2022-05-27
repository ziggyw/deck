import type { ILoadBalancerModalProps } from '@spinnaker/core';

import { ALBConfigureLoadBalancerModal } from '../alb/ALBConfigureLoadBalancerModal';
// import { CreateApplicationLoadBalancer } from '../application/CreateApplicationLoadBalancer';
// import { CreateClassicLoadBalancer } from './classic/CreateClassicLoadBalancer';
// import { ALICLOUD_LOADBALANCER_CREATE } from '../createLoadBalancer.controller';
import { CLBConfigureLoadBalancerModal } from '../clb/CLBConfigureLoadBalancerModal';
import type { IAlicloudLoadBalancerUpsertCommand } from '../../../domain';

export interface ICloseableLoadBalancerModal extends React.ComponentClass<ILoadBalancerModalProps> {
  show: (props: ILoadBalancerModalProps) => Promise<IAlicloudLoadBalancerUpsertCommand>;
}

export interface IAlicloudLoadBalancerConfig {
  type: 'application' | 'classic';
  label: string;
  sublabel: string;
  description: string;
  component: ICloseableLoadBalancerModal;
}

export const LoadBalancerTypes: IAlicloudLoadBalancerConfig[] = [
  {
    type: 'application',
    label: 'Application',
    sublabel: 'ALB',
    description: 'Highly configurable, application-focused balancer. HTTP and HTTPS only.',
    component: ALBConfigureLoadBalancerModal,
  },
  {
    type: 'classic',
    label: 'Classic',
    sublabel: 'CLB',
    description: 'Previous generation balancer (CLB).',
    component: CLBConfigureLoadBalancerModal,
  },
];
