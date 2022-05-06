import type { FormikProps } from 'formik';
import React from 'react';

import type { IWizardPageComponent } from '@spinnaker/core';
import { FormikFormField, FormValidator, MapEditorInput } from '@spinnaker/core';
import { alicloudTagsValidator } from '../alicoud.validators';
import type { AlicloudFunction } from '../../domain';
import type { AlicloudFunctionUpsertCommand } from '../../domain';

export interface IFunctionTagsProps {
  formik: FormikProps<AlicloudFunctionUpsertCommand>;
  isNew?: boolean;
  functionDef: AlicloudFunction;
}

export class FunctionTags
  extends React.Component<IFunctionTagsProps>
  implements IWizardPageComponent<AlicloudFunctionUpsertCommand> {
  public validate = (values: AlicloudFunctionUpsertCommand) => {
    const validator = new FormValidator(values);
    validator.field('tags', 'Tag').required().withValidators(alicloudTagsValidator);
    return validator.validateForm();
  };

  public render() {
    return (
      <div className="container-fluid form-horizontal ">
        <FormikFormField
          name="tags"
          input={(props) => <MapEditorInput {...props} allowEmptyValues={false} addButtonLabel="Add" />}
        />
      </div>
    );
  }
}
