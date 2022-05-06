import type { FormikErrors, FormikProps } from 'formik';
import React from 'react';

import type { IWizardPageComponent } from '@spinnaker/core';
import { FormikFormField, FormValidator, HelpField, ReactSelectInput, TextInput } from '@spinnaker/core';
import { alicloudArnValidator } from '../alicoud.validators';
import type { AlicloudFunction } from '../../domain';
import type { AlicloudFunctionUpsertCommand } from '../../domain';

export interface IFunctionDebugAndErrorHandlingProps {
  formik: FormikProps<AlicloudFunctionUpsertCommand>;
  isNew?: boolean;
  functionDef: AlicloudFunction;
}

export class FunctionDebugAndErrorHandling
  extends React.Component<IFunctionDebugAndErrorHandlingProps>
  implements IWizardPageComponent<AlicloudFunctionUpsertCommand> {
  constructor(props: IFunctionDebugAndErrorHandlingProps) {
    super(props);
  }

  public validate = (values: AlicloudFunctionUpsertCommand): FormikErrors<AlicloudFunctionUpsertCommand> => {
    const validator = new FormValidator(values);
    validator.field('deadLetterConfig.targetArn', 'Target ARN').optional().withValidators(alicloudArnValidator);
    return validator.validateForm();
  };

  public render() {
    return (
      <div className="container-fluid form-horizontal ">
        Dead Letter Config
        <FormikFormField
          name="deadLetterConfig.targetArn"
          label="Target ARN"
          help={<HelpField id="alicloud.function.deadletterqueue" />}
          input={(props) => <TextInput {...props} />}
        />
        X-Ray Tracing
        <FormikFormField
          name="tracingConfig.mode"
          label="Mode"
          help={<HelpField id="alicloud.function.tracingConfig.mode" />}
          input={(props) => <ReactSelectInput {...props} stringOptions={['Active', 'PassThrough']} clearable={true} />}
        />
      </div>
    );
  }
}
