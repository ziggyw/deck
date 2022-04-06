import * as React from 'react';

import type { IExecutionDetailsSectionProps } from '@spinnaker/core';
import { AsgActionExecutionDetailsSection } from '@spinnaker/core';

export function DestroyAsg(props: IExecutionDetailsSectionProps) {
  return <AsgActionExecutionDetailsSection {...props} action="Destroyed" />;
}

// TODO: refactor this to not use namespace
// eslint-disable-next-line
export namespace DestroyAsgExecutionDetails {
  export const title = 'destroyServerGroupConfig';
}
