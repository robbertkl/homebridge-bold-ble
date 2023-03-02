import { EventEmitter } from 'node:events';

import fetch from 'node-fetch';

import type {
  BoldApiAuthentication,
  BoldApiCommand,
  BoldApiCommandsResponse,
  BoldApiDevice,
  BoldApiEffectiveDevicePermissionsResponse,
  BoldApiErrorResponse,
  BoldApiHandshake,
  BoldApiHandshakesResponse,
  BoldApiOAuthResponse,
  BoldApiVerifyCodeResponse,
  BoldDefaultAuthResponse,
} from './types';

const BASE_URL = 'https://api.boldsmartlock.com/';
const DEFAULT_AUTH_REFRESH_URL = 'https://bold.nienhuisdevelopment.com/oauth/refresh';

const LEGACY_AUTH_CLIENT_ID = 'BoldApp';
const LEGACY_CLIENT_SECRET = 'pgJFgnGB87f9ednFiiHygCbf';

export type BoldApiEvent = {
  refresh: (newAuth: BoldApiAuthentication, oldAuth?: BoldApiAuthentication) => void;
};

export declare interface BoldApi {
  on<U extends keyof BoldApiEvent>(event: U, listener: BoldApiEvent[U]): this;
  off<U extends keyof BoldApiEvent>(event: U, listener: BoldApiEvent[U]): this;
  emit<U extends keyof BoldApiEvent>(event: U, ...args: Parameters<BoldApiEvent[U]>): boolean;
}

export class BoldApi extends EventEmitter {
  private tokenExpiry?: Date;

  constructor(private auth?: Readonly<BoldApiAuthentication>) {
    super();
  }

  private updateAuth(newAuth: BoldApiAuthentication) {
    const oldAuth = this.auth;
    this.auth = newAuth;
    this.emit('refresh', newAuth, oldAuth);
  }

  public async call<ResponseType = Record<string, never>>(
    method: 'GET' | 'POST',
    endpoint: string,
    payload?: Record<string, string | number | boolean | null>,
    needsAuth = true,
    asFormData = false
  ): Promise<ResponseType> {
    const url = `${BASE_URL}${endpoint.replace(/^\//, '')}`;

    const headers: HeadersInit = {};
    if (needsAuth) {
      if (!this.auth) {
        throw new Error('Missing access token');
      }

      if (!this.tokenExpiry || new Date() > this.tokenExpiry) {
        await this.refresh();
      }

      headers['Authorization'] = `Bearer ${this.auth.accessToken}`;
    }

    if (payload) {
      headers['ContentType'] = asFormData ? 'application/x-www-form-urlencoded' : 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body:
        payload &&
        (asFormData ? new URLSearchParams(payload as Record<string, string>).toString() : JSON.stringify(payload)),
    });

    let body: ResponseType;
    try {
      body = (await response.json()) as ResponseType;
    } catch (error: unknown) {
      throw new Error(await response.text());
    }

    if (!response.ok) {
      const error = body as BoldApiErrorResponse;
      throw new Error(
        error.error_description ??
          error.errorMessage ??
          error.message ??
          error.error ??
          error.errorCode ??
          error.code ??
          'Unknown API response'
      );
    }

    return body;
  }

  public async requestVerificationCode(phoneNumber: string) {
    await this.call(
      'POST',
      'v2/verification/request-code',
      {
        phoneNumber,
        language: 'en',
        destination: 'Phone',
      },
      false
    );
  }

  public async verifyVerificationCode(phoneNumber: string, verificationCode: string) {
    const { verificationToken } = await this.call<BoldApiVerifyCodeResponse>(
      'POST',
      'v2/verification/verify-code',
      {
        phoneNumber,
        verificationCode,
      },
      false
    );

    return verificationToken;
  }

  private processLegacyAuthResponse(
    response: BoldApiOAuthResponse,
    requestTime: Date = new Date()
  ): BoldApiAuthentication {
    const auth: BoldApiAuthentication = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      legacyAuthentication: true,
    };

    this.updateAuth(auth);
    this.tokenExpiry = new Date(requestTime.getTime() + (response.expires_in ?? 86400) * 1000);
    return auth;
  }

  private processDefaultAuthResponse(
    response: BoldDefaultAuthResponse,
    requestTime: Date = new Date()
  ): BoldApiAuthentication {
    if (!response.success) {
      throw new Error(response.error.message);
    }

    const auth: BoldApiAuthentication = {
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      legacyAuthentication: false,
      ...(this.auth?.refreshURL && { refreshURL: this.auth.refreshURL }),
    };

    this.updateAuth(auth);
    this.tokenExpiry = new Date(requestTime.getTime() + 86400 * 1000);
    return auth;
  }

  public async login(phoneNumber: string, password: string, verificationToken: string): Promise<BoldApiAuthentication> {
    const now = new Date();
    const response = await this.call<BoldApiOAuthResponse>(
      'POST',
      'v2/oauth/token',
      {
        grant_type: 'password',
        username: phoneNumber,
        password,
        mfa_token: verificationToken,
        client_id: LEGACY_AUTH_CLIENT_ID,
        client_secret: LEGACY_CLIENT_SECRET,
      },
      false,
      true
    );

    return this.processLegacyAuthResponse(response, now);
  }

  public async refresh(): Promise<BoldApiAuthentication> {
    if (!this.auth) {
      throw new Error('Missing refresh token');
    }

    if (this.auth.legacyAuthentication) {
      const now = new Date();
      const response = await this.call<BoldApiOAuthResponse>(
        'POST',
        'v2/oauth/token',
        {
          grant_type: 'refresh_token',
          refresh_token: this.auth.refreshToken,
          client_id: LEGACY_AUTH_CLIENT_ID,
          client_secret: LEGACY_CLIENT_SECRET,
        },
        false,
        true
      );

      return this.processLegacyAuthResponse(response, now);
    } else {
      const now = new Date();
      const response = await fetch(this.auth.refreshURL ?? DEFAULT_AUTH_REFRESH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.auth.refreshToken }),
      });

      let body: BoldDefaultAuthResponse;
      try {
        body = (await response.json()) as BoldDefaultAuthResponse;
      } catch (error: unknown) {
        throw new Error('Token refresh failed');
      }

      return this.processDefaultAuthResponse(body, now);
    }
  }

  public async getEffectiveDevicePermissions(): Promise<BoldApiDevice[]> {
    return await this.call<BoldApiEffectiveDevicePermissionsResponse>('GET', 'v1/effective-device-permissions');
  }

  public async getHandshakes(deviceId: number): Promise<BoldApiHandshake[]> {
    return await this.call<BoldApiHandshakesResponse>(
      'GET',
      `v1/controller/v0/handshakes?deviceId=${encodeURIComponent(deviceId)}`
    );
  }

  public async getActivateCommands(deviceId: number): Promise<BoldApiCommand[]> {
    return await this.call<BoldApiCommandsResponse>(
      'GET',
      `v1/controller/v0/commands/activate-device?deviceId=${encodeURIComponent(deviceId)}`
    );
  }
}
