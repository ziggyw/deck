import * as React from 'react';
import { Modal } from 'react-bootstrap';
import { Subject } from 'rxjs';

import {
  ModalClose,
  noop,
  ReactInjector,
  ReactModal,
  TaskMonitor,
  TaskMonitorWrapper,
  TaskReason,
} from '@spinnaker/core';

import { AlicloudFooter } from '../../../common/AlicloudFooter';

export class AlicloudResizeServerGroupModal extends React.Component {
  public static defaultProps: any = {
    closeModal: noop,
    dismissModal: noop,
  };

  public sub$ = new Subject();

  public static show(props: any): Promise<any> {
    const modalProps = {};
    return ReactModal.show(AlicloudResizeServerGroupModal, props, modalProps);
  }

  constructor(props: any) {
    super(props);
    const { serverGroup, application, dismissModal } = props;
    this.state = {
      minSize: serverGroup.result.scalingGroup.minSize,
      maxSize: serverGroup.result.scalingGroup.maxSize,
      reason: '',
      minSizePattern: true,
      maxSizePattern: true,
      isvalid: false,
      taskMonitor: new TaskMonitor({
        application: application,
        title: 'Resizing' + serverGroup.name,
        modalInstance: TaskMonitor.modalInstanceEmulation(() => dismissModal),
        onTaskComplete: () => application.serverGroups.refresh(),
      }),
      platformHealthOnlyShowOverride: application.platformHealthOnlyShowOverride,
    };
    this.isValid();
  }

  private serverGroups: any = this.props;

  private stat = {
    minSize: this.serverGroups.serverGroup.result.scalingGroup.minSize,
    maxSize: this.serverGroups.serverGroup.result.scalingGroup.maxSize,
  };

  private isValid = () => {
    const { serverGroup }: any = this.props;
    this.sub$.subscribe(() => {
      this.setState({
        isvalid: true,
      });
    });
    if (
      serverGroup.result.scalingGroup.minSize === this.stat.minSize &&
      serverGroup.result.scalingGroup.maxSize === this.stat.maxSize
    ) {
      this.setState({
        isvalid: false,
      });
    }
  };

  private minSizePatterns = (value: number) => {
    if (value > this.stat.maxSize) {
      this.setState({
        minSizePattern: false,
        maxSizePattern: true,
      });
    } else {
      this.setState({
        minSizePattern: true,
        maxSizePattern: true,
      });
    }
  };
  private maxSizePatterns = (value: number) => {
    if (value < this.stat.minSize) {
      this.setState({
        maxSizePattern: false,
        minSizePattern: true,
      });
    } else {
      this.setState({
        minSizePattern: true,
        maxSizePattern: true,
      });
    }
  };

  private close = (args?: any): void => {
    const { dismissModal }: any = this.props;
    dismissModal.apply(null, args);
  };

  private submit = (): void => {
    const { serverGroup, application }: any = this.props;
    const { taskMonitor, reason }: any = this.state;
    const capacity = { min: this.stat.minSize, max: this.stat.maxSize, desired: this.stat.minSize };
    taskMonitor.submit(() => {
      return ReactInjector.serverGroupWriter.resizeServerGroup(serverGroup, application, {
        capacity: capacity,
        minSize: this.stat.minSize,
        maxSize: this.stat.maxSize,
        reason: reason,
      });
    });
  };
  public render() {
    const { serverGroup }: any = this.props;
    const { taskMonitor, maxSize, minSize, minSizePattern, reason, isvalid, maxSizePattern }: any = this.state;

    return (
      <div>
        <TaskMonitorWrapper monitor={taskMonitor} />
        <Modal.Header>
          <Modal.Title>{'Resize ' + serverGroup.name}</Modal.Title>
        </Modal.Header>
        <ModalClose dismiss={this.close} />
        <Modal.Body>
          <form role="form">
            <div className="modal-body confirmation-modal">
              <div className="form-group row">
                <label className="col-md-3 sm-label-right" />
                <label className="col-md-3 sm-label-left">Min</label>
                <label className="col-md-4 sm-label-left">Max</label>
              </div>
              <div className="form-group row">
                <label className="col-md-3 sm-label-right">Current</label>
                <div className="col-md-3">
                  <input
                    disabled={true}
                    type="number"
                    className="form-control input-sm"
                    value={serverGroup.result.scalingGroup.minSize}
                    name="search"
                  />
                </div>
                <div className="col-md-4">
                  <input
                    disabled={true}
                    type="number"
                    className="form-control input-sm"
                    value={serverGroup.result.scalingGroup.maxSize}
                    name="search"
                  />
                </div>
              </div>
              <div className="form-group row">
                <label className="col-md-3 sm-label-right">Resize to</label>
                <div className="col-md-3">
                  <input
                    type="number"
                    required={true}
                    className="form-control input-sm"
                    value={minSize}
                    name="MinSize"
                    onChange={(e: any) => {
                      this.sub$.next(e.target.value);
                      this.setState({
                        minSize: e.target.value,
                      });
                      this.stat.minSize = e.target.value;
                      this.minSizePatterns(e.target.value);
                      this.isValid();
                    }}
                  />
                </div>
                <div className="col-md-4">
                  <input
                    type="number"
                    required={true}
                    className="form-control input-sm"
                    value={maxSize}
                    name="MaxSize"
                    onChange={(e: any) => {
                      this.sub$.next(e.target.value);
                      this.setState({
                        maxSize: e.target.value,
                      });
                      this.stat.maxSize = e.target.value;
                      this.maxSizePatterns(e.target.value);
                      this.isValid();
                    }}
                  />
                </div>
              </div>
              {!minSizePattern && (
                <div className="form-group row slide-in">
                  <div className="col-sm-9 col-sm-offset-2 error-message">
                    <span>MinSize do not large than MaxSize.</span>
                  </div>
                </div>
              )}
              {!maxSizePattern && (
                <div className="form-group row slide-in">
                  <div className="col-sm-9 col-sm-offset-2 error-message">
                    <span>MxaSize do not small than MinSize.</span>
                  </div>
                </div>
              )}
              <TaskReason
                reason={reason}
                onChange={(value: any) => {
                  this.sub$.next(value);
                  this.setState({
                    reason: value,
                  });
                }}
              />
              <div className="form-group row">
                <label className="col-md-3 sm-label-right">Changes</label>
                <div className="col-md-7 sm-control-field">
                  <div>
                    Min:<b>{serverGroup.result.scalingGroup.minSize}</b>
                    <i className="fa fa-long-arrow-alt-right" />
                    <b>{minSize}</b>
                  </div>
                  <div>
                    Max:<b>{serverGroup.result.scalingGroup.maxSize}</b>
                    <i className="fa fa-long-arrow-alt-right" />
                    <b>{maxSize}</b>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </Modal.Body>
        <AlicloudFooter onSubmit={this.submit} onCancel={this.close} isValid={isvalid} account={serverGroup.account} />
      </div>
    );
  }
}
