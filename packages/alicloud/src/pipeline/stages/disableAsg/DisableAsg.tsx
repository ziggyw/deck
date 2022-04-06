import * as React from 'react';

import type { IExecutionDetailsSectionProps } from '@spinnaker/core';
import { AsgActionExecutionDetailsSection } from '@spinnaker/core';

export function DisableAsg(props: IExecutionDetailsSectionProps) {
  return <AsgActionExecutionDetailsSection {...props} action="Disabled" />;
}

// TODO: refactor this to not use namespace
// eslint-disable-next-line
export namespace DisableAsgExecutionDetails {
  export const title = 'disableServerGroupConfig';
}
