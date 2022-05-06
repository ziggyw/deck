import type { FormikProps } from 'formik';
import React from 'react';

import type { IWizardPageComponent } from '@spinnaker/core';
import { FormikFormField, HelpField, NumberInput, TextInput } from '@spinnaker/core';
import type { AlicloudFunction } from '../../domain';
import type { AlicloudFunctionUpsertCommand } from '../../domain';

export interface IFunctionSettingsProps {
  formik: FormikProps<AlicloudFunctionUpsertCommand>;
  isNew?: boolean;
  functionDef: AlicloudFunction;
}

export class FunctionSettings
  extends React.Component<IFunctionSettingsProps>
  implements IWizardPageComponent<AlicloudFunctionUpsertCommand> {
  public validate = () => {
    const errors = {} as any;
    return errors;
  };

  public render() {
    return (
      <div className="container-fluid form-horizontal ">
        <FormikFormField name="description" label="Description" input={(props) => <TextInput {...props} />} />
        <FormikFormField
          name="memorySize"
          label="Memory (MB)"
          help={<HelpField id="alicloud.functionBasicSettings.memorySize" />}
          input={(props) => <NumberInput {...props} min={128} max={3008} />}
        />
        <FormikFormField
          name="timeout"
          label="Timeout (seconds)"
          help={<HelpField id="alicloud.functionBasicSettings.timeout" />}
          input={(props) => <NumberInput {...props} min={1} max={900} />}
        />
        <FormikFormField name="targetGroups" label="Target Group Name" input={(props) => <TextInput {...props} />} />
      </div>
    );
  }
}
