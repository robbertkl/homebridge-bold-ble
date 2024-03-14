/// <reference types="node" />
import { EventEmitter } from 'node:events';
import type { BoldApiAuthentication, BoldApiCommand, BoldApiDevice, BoldApiHandshake } from './types';
export declare type BoldApiEvent = {
    refresh: (newAuth: BoldApiAuthentication, oldAuth?: BoldApiAuthentication) => void;
};
export declare interface BoldApi {
    on<U extends keyof BoldApiEvent>(event: U, listener: BoldApiEvent[U]): this;
    off<U extends keyof BoldApiEvent>(event: U, listener: BoldApiEvent[U]): this;
    emit<U extends keyof BoldApiEvent>(event: U, ...args: Parameters<BoldApiEvent[U]>): boolean;
}
export declare class BoldApi extends EventEmitter {
    private auth?;
    private tokenExpiry?;
    constructor(auth?: Readonly<BoldApiAuthentication> | undefined);
    private updateAuth;
    call<ResponseType = Record<string, never>>(method: 'GET' | 'POST', endpoint: string, payload?: Record<string, string | number | boolean | null>, needsAuth?: boolean, asFormData?: boolean): Promise<ResponseType>;
    requestVerificationCode(phoneNumber: string): Promise<void>;
    verifyVerificationCode(phoneNumber: string, verificationCode: string): Promise<string>;
    private processLegacyAuthResponse;
    private processDefaultAuthResponse;
    login(phoneNumber: string, password: string, verificationToken: string): Promise<BoldApiAuthentication>;
    refresh(): Promise<BoldApiAuthentication>;
    getEffectiveDevicePermissions(): Promise<BoldApiDevice[]>;
    getHandshakes(deviceId: number): Promise<BoldApiHandshake[]>;
    getActivateCommands(deviceId: number): Promise<BoldApiCommand[]>;
}
//# sourceMappingURL=api.d.ts.map