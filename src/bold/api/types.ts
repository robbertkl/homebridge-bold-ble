type Base64String = string;
type IsoDateTimeString = string;

export type BoldApiAuthentication = {
  accessToken: string;
  refreshToken: string;
  legacyAuthentication: boolean;
  refreshURL?: string;
};

export type BoldApiDeviceOwner = {
  organizationId: number;
  accountId: number;
  name: string;
  firstName: string;
  lastName: string;
};

export type BoldApiDeviceModel = {
  id: number;
  make: string;
  model: string;
  name: string;
  isCertified: boolean;
  deviceType: BoldApiDeviceType;
};

export type BoldApiDeviceType = {
  id: number; // 1 = lock.
  name: string;
  description: string;
};

export type BoldApiDevicePermissionSchedule = {
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  period: {
    startTime: string;
    endTime: string;
  };
  recurrence: 'Weekly';
};

export type BoldApiDevicePermission = {
  devicePermission: 'UseDevice' | string;
  schedule: BoldApiDevicePermissionSchedule[];
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
};

export type BoldApiDeviceSettings = {
  deviceId: number;
  activationTime: number;
  soundVolume: number;
  pressButtonActivation: boolean;
  controllerFunctionality: boolean;
  backupPin1: number; // 5-digit number or 0 if this pin is disabled.
  backupPin2: number; // 5-digit number or 0 if this pin is disabled.
  backupPin3: number; // 5-digit number or 0 if this pin is disabled.
  backupPinsConfigured: boolean;
  acknowledged: boolean;
  dateCreated: IsoDateTimeString;
  dateModified: IsoDateTimeString;
  backupPin1Name?: string;
  backupPin2Name?: string;
  backupPin3Name?: string;
  dateLastExternalSync: IsoDateTimeString;
  relayNormallyOpen: boolean;
  vibrationTamperDetection: boolean;
  vibrationTamperSensitivity: number;
  rotationsTamperDetection: boolean;
};

export type BoldApiDeviceFeatureSet = {
  isActivatable: boolean;
  storeDeviceEvents: boolean;
};

export type BoldApiDevice = {
  id: number;
  deviceId: number;
  serial?: string;
  owner: BoldApiDeviceOwner;
  name: string;
  personalName: string;
  organizationId: number;
  model: BoldApiDeviceModel;
  type: BoldApiDeviceType;
  actualFirmwareVersion: number;
  requiredFirmwareVersion: number;
  dateCreated: IsoDateTimeString;
  dateModified: IsoDateTimeString;
  timeZone: string;
  batteryLevel: 'Excellent' | string; // Not sure what the other values are.
  batteryLastMeasurement: IsoDateTimeString;
  settingsAcknowledged: boolean;
  permissions: BoldApiDevicePermission[];
  permissionAdministrate: boolean;
  permissionRemoteActivate: boolean;
  permissionAssignKeyfob: boolean;
  organizationSuperUser: boolean;
  permissionHash: Base64String;
  settings: BoldApiDeviceSettings;
  featureSet: BoldApiDeviceFeatureSet;
  synced: boolean;
  secure: boolean;
  carouselImageUrl: string;
};

export type BoldApiHandshake = {
  deviceId: number;
  clientId: number;
  expiration: IsoDateTimeString;
  handshakeKey: Base64String; // 16 bytes, changes every request.
  permissionHash: Base64String; // 32 bytes
  payload: Base64String; // 57 bytes, changes every request.
};

const BoldApiCommandTypes = {
  Activate: 1,
  ActivateWithKeepActive: 2,
  Deactivate: 3,
} as const;

export type BoldApiCommandType = typeof BoldApiCommandTypes[keyof typeof BoldApiCommandTypes];

export type BoldApiCommand = {
  deviceId: number;
  commandType: BoldApiCommandType;
  expiration: IsoDateTimeString;
  permissionHash: Base64String; // 32 bytes
  payload: Base64String; // 46 bytes, changes every request.
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

export type BoldApiEffectiveDevicePermissionsResponse = BoldApiDevice[];

export type BoldApiHandshakesResponse = BoldApiHandshake[];

export type BoldApiCommandsResponse = BoldApiCommand[];
