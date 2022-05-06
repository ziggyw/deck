import type { FormikProps } from 'formik';
import React from 'react';

import type { IWizardPageComponent } from '@spinnaker/core';
import { FormikFormField, FormValidator, HelpField, MapEditorInput, TextInput } from '@spinnaker/core';
import { alicloudArnValidator } from '../alicoud.validators';
import type { AlicloudFunction } from '../../domain';
import type { AlicloudFunctionUpsertCommand } from '../../domain';

export interface IFunctionEnvironmentVariablesProps {
  formik: FormikProps<AlicloudFunctionUpsertCommand>;
  isNew?: boolean;
  functionDef: AlicloudFunction;
}

export class FunctionEnvironmentVariables
  extends React.Component<IFunctionEnvironmentVariablesProps>
  implements IWizardPageComponent<AlicloudFunctionUpsertCommand> {
  public validate = (values: AlicloudFunctionUpsertCommand) => {
    const validator = new FormValidator(values);
    validator.field('kmskeyArn', 'KMS Key ARN').optional().withValidators(alicloudArnValidator);
    return validator.validateForm();
  };

  public render() {
    return (
      <div className="container-fluid form-horizontal ">
        <FormikFormField
          name="envVariables"
          label="Env Variables"
          input={(props) => <MapEditorInput {...props} allowEmptyValues={true} addButtonLabel="Add" />}
        />
        <FormikFormField
          name="kmskeyArn"
          label="Key ARN"
          help={<HelpField id="alicloud.function.kmsKeyArn" />}
          input={(props) => <TextInput {...props} />}
        />
      </div>
    );
  }
}
