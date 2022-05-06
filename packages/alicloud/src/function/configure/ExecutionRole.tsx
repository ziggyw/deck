import type { FormikErrors, FormikProps } from 'formik';
import React from 'react';

import type { IWizardPageComponent } from '@spinnaker/core';
import { FormikFormField, FormValidator, TextInput } from '@spinnaker/core';
import { iamRoleValidator } from '../alicoud.validators';
import type { AlicloudFunction } from '../../domain';
import type { AlicloudFunctionUpsertCommand } from '../../domain';

export interface IExecutionRoleProps {
  formik: FormikProps<AlicloudFunctionUpsertCommand>;
  isNew?: boolean;
  functionDef: AlicloudFunction;
}

export class ExecutionRole
  extends React.Component<IExecutionRoleProps>
  implements IWizardPageComponent<AlicloudFunctionUpsertCommand> {
  constructor(props: IExecutionRoleProps) {
    super(props);
  }

  public validate(values: AlicloudFunctionUpsertCommand): FormikErrors<AlicloudFunctionUpsertCommand> {
    const validator = new FormValidator(values);
    validator.field('role', 'Role ARN').required().withValidators(iamRoleValidator);
    return validator.validateForm();
  }

  public render() {
    return (
      <div className="form-group">
        <div className="col-md-11">
          <div className="sp-margin-m-bottom">
            <FormikFormField
              name="role"
              label="Role ARN"
              input={(props) => <TextInput {...props} placeholder="Enter role ARN" name="role" />}
              required={true}
            />
          </div>
        </div>
      </div>
    );
  }
}
