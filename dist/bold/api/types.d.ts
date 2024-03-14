declare type Base64String = string;
declare type IsoDateTimeString = string;
export declare type BoldApiAuthentication = {
    accessToken: string;
    refreshToken: string;
    legacyAuthentication: boolean;
    refreshURL?: string;
};
export declare type BoldApiDeviceOwner = {
    organizationId: number;
    accountId: number;
    name: string;
    firstName: string;
    lastName: string;
};
export declare type BoldApiDeviceModel = {
    id: number;
    make: string;
    model: string;
    name: string;
    isCertified: boolean;
    deviceType: BoldApiDeviceType;
};
export declare type BoldApiDeviceType = {
    id: number;
    name: string;
    description: string;
};
export declare type BoldApiDevicePermissionSchedule = {
    dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
    period: {
        startTime: string;
        endTime: string;
    };
    recurrence: 'Weekly';
};
export declare type BoldApiDevicePermission = {
    devicePermission: 'UseDevice' | string;
    schedule: BoldApiDevicePermissionSchedule[];
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
};
export declare type BoldApiDeviceSettings = {
    deviceId: number;
    activationTime: number;
    soundVolume: number;
    pressButtonActivation: boolean;
    controllerFunctionality: boolean;
    backupPin1: number;
    backupPin2: number;
    backupPin3: number;
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
export declare type BoldApiDeviceFeatureSet = {
    isActivatable: boolean;
    storeDeviceEvents: boolean;
};
export declare type BoldApiDevice = {
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
    batteryLevel: 'Excellent' | string;
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
export declare type BoldApiHandshake = {
    deviceId: number;
    clientId: number;
    expiration: IsoDateTimeString;
    handshakeKey: Base64String;
    permissionHash: Base64String;
    payload: Base64String;
};
declare const BoldApiCommandTypes: {
    readonly Activate: 1;
    readonly ActivateWithKeepActive: 2;
    readonly Deactivate: 3;
};
export declare type BoldApiCommandType = typeof BoldApiCommandTypes[keyof typeof BoldApiCommandTypes];
export declare type BoldApiCommand = {
    deviceId: number;
    commandType: BoldApiCommandType;
    expiration: IsoDateTimeString;
    permissionHash: Base64String;
    payload: Base64String;
};
export declare type BoldApiErrorResponse = {
    error?: string;
    error_description?: string;
    message?: string;
    code?: string;
    errorMessage?: string;
    errorCode?: string;
};
export declare type BoldApiVerifyCodeResponse = {
    verificationToken: string;
};
export declare type BoldApiOAuthResponse = {
    access_token: string;
    refresh_token: string;
    token_type: 'Bearer';
    expires_in: number;
    account_id: number;
};
export declare type BoldDefaultAuthResponse = {
    success: true;
    data: {
        accessToken: string;
        refreshToken: string;
    };
} | {
    success: false;
    error: {
        code: number;
        message: string;
    };
};
export declare type BoldApiEffectiveDevicePermissionsResponse = BoldApiDevice[];
export declare type BoldApiHandshakesResponse = BoldApiHandshake[];
export declare type BoldApiCommandsResponse = BoldApiCommand[];
export {};
//# sourceMappingURL=types.d.ts.map