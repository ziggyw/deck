'use strict';

import { module } from 'angular';

import { REST } from '@spinnaker/core';

export class AlicloudImageReader {
  public findImages(params: any) {
    return REST('images/find')
      .query(params)
      .get()
      .then(
        function (results: any) {
          return results;
        },
        function (): any[] {
          return [];
        },
      );
  }

  public getImage(amiName: string, region: string, credentials: string) {
    return REST('/images')
      .path(credentials, region, amiName)
      .query({ provider: 'alicloud' })
      .get()
      .then(
        function (results: any) {
          return results && results.length ? results[0] : null;
        },
        function (): any {
          return null;
        },
      );
  }
}

export const ALICLOUD_IMAGE = 'spinnaker.alicloud.image.reader';
module(ALICLOUD_IMAGE, []).service('alicloudImageReader', AlicloudImageReader);
