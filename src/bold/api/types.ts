// See API docs at: https://apidoc.boldsmartlock.com/

type Base64String = string;
type IsoDateTimeString = string;

export type BoldApiAuthentication = {
  accessToken: string;
  refreshToken: string;
  legacyAuthentication: boolean;
  refreshURL?: string;
};

export type BoldApiErrorResponse = {
  error?: string;
  error_description?: string;
  message?: string;
  code?: string;
  errorMessage?: string;
  errorCode?: string;
};

export type BoldApiVerifyCodeResponse = {
  verificationToken: string;
};

export type BoldApiOAuthResponse = {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  account_id: number;
};

export type BoldDefaultAuthResponse =
  | {
      success: true;
      data: {
        accessToken: string;
        refreshToken: string;
      };
    }
  | {
      success: false;
      error: {
        code: number;
        message: string;
      };
    };

export type BoldApiDevice = {
  id: number;
  name: string;
  owner: {
    organizationId: number;
  };
  model: {
    id: number;
    name: string;
    type: {
      id: number; // 1 = lock.
    };
  };
  actualFirmwareVersion: number;
};

export type BoldApiEffectiveDevicePermission = {
  permissions: {
    remoteActivate: boolean;
  };
  device: BoldApiDevice;
};

export type BoldApiHandshake = {
  deviceId: number;
  expiration: IsoDateTimeString;
  handshakeKey: Base64String; // 16 bytes, changes every request.
  payload: Base64String; // 57 bytes, changes every request.
};

export type BoldApiCommandType = 'Activate' | 'AutoActivate' | 'KeepActive' | 'PreActivate' | 'Deactivate' | 'Firmware';

export type BoldApiCommand = {
  deviceId: number;
  commandType: BoldApiCommandType;
  expiration: IsoDateTimeString;
  payload: Base64String; // 46 bytes, changes every request.
};


export type BoldApiEffectiveDevicePermissionsResponse = BoldApiEffectiveDevicePermission[];

export type BoldApiHandshakesResponse = BoldApiHandshake[];

export type BoldApiCommandsResponse = BoldApiCommand[];
