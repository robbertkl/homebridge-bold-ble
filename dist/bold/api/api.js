"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoldApi = void 0;
const node_events_1 = require("node:events");
const node_fetch_1 = __importDefault(require("node-fetch"));
const BASE_URL = 'https://api.boldsmartlock.com/';
const DEFAULT_AUTH_REFRESH_URL = 'https://bold.nienhuisdevelopment.com/oauth/refresh';
const LEGACY_AUTH_CLIENT_ID = 'BoldApp';
const LEGACY_CLIENT_SECRET = 'pgJFgnGB87f9ednFiiHygCbf';
class BoldApi extends node_events_1.EventEmitter {
    constructor(auth) {
        super();
        this.auth = auth;
    }
    updateAuth(newAuth) {
        const oldAuth = this.auth;
        this.auth = newAuth;
        this.emit('refresh', newAuth, oldAuth);
    }
    async call(method, endpoint, payload, needsAuth = true, asFormData = false) {
        var _a, _b, _c, _d, _e, _f;
        const url = `${BASE_URL}${endpoint.replace(/^\//, '')}`;
        const headers = {};
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
        const response = await (0, node_fetch_1.default)(url, {
            method,
            headers,
            body: payload &&
                (asFormData ? new URLSearchParams(payload).toString() : JSON.stringify(payload)),
        });
        let body;
        try {
            body = (await response.json());
        }
        catch (error) {
            throw new Error(await response.text());
        }
        if (!response.ok) {
            const error = body;
            throw new Error((_f = (_e = (_d = (_c = (_b = (_a = error.error_description) !== null && _a !== void 0 ? _a : error.errorMessage) !== null && _b !== void 0 ? _b : error.message) !== null && _c !== void 0 ? _c : error.error) !== null && _d !== void 0 ? _d : error.errorCode) !== null && _e !== void 0 ? _e : error.code) !== null && _f !== void 0 ? _f : 'Unknown API response');
        }
        return body;
    }
    async requestVerificationCode(phoneNumber) {
        await this.call('POST', 'v2/verification/request-code', {
            phoneNumber,
            language: 'en',
            destination: 'Phone',
        }, false);
    }
    async verifyVerificationCode(phoneNumber, verificationCode) {
        const { verificationToken } = await this.call('POST', 'v2/verification/verify-code', {
            phoneNumber,
            verificationCode,
        }, false);
        return verificationToken;
    }
    processLegacyAuthResponse(response, requestTime = new Date()) {
        var _a;
        const auth = {
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            legacyAuthentication: true,
        };
        this.updateAuth(auth);
        this.tokenExpiry = new Date(requestTime.getTime() + ((_a = response.expires_in) !== null && _a !== void 0 ? _a : 86400) * 1000);
        return auth;
    }
    processDefaultAuthResponse(response, requestTime = new Date()) {
        var _a;
        if (!response.success) {
            throw new Error(response.error.message);
        }
        const auth = {
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken,
            legacyAuthentication: false,
            ...(((_a = this.auth) === null || _a === void 0 ? void 0 : _a.refreshURL) && { refreshURL: this.auth.refreshURL }),
        };
        this.updateAuth(auth);
        this.tokenExpiry = new Date(requestTime.getTime() + 86400 * 1000);
        return auth;
    }
    async login(phoneNumber, password, verificationToken) {
        const now = new Date();
        const response = await this.call('POST', 'v2/oauth/token', {
            grant_type: 'password',
            username: phoneNumber,
            password,
            mfa_token: verificationToken,
            client_id: LEGACY_AUTH_CLIENT_ID,
            client_secret: LEGACY_CLIENT_SECRET,
        }, false, true);
        return this.processLegacyAuthResponse(response, now);
    }
    async refresh() {
        var _a;
        if (!this.auth) {
            throw new Error('Missing refresh token');
        }
        if (this.auth.legacyAuthentication) {
            const now = new Date();
            const response = await this.call('POST', 'v2/oauth/token', {
                grant_type: 'refresh_token',
                refresh_token: this.auth.refreshToken,
                client_id: LEGACY_AUTH_CLIENT_ID,
                client_secret: LEGACY_CLIENT_SECRET,
            }, false, true);
            return this.processLegacyAuthResponse(response, now);
        }
        else {
            const now = new Date();
            const response = await (0, node_fetch_1.default)((_a = this.auth.refreshURL) !== null && _a !== void 0 ? _a : DEFAULT_AUTH_REFRESH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: this.auth.refreshToken }),
            });
            let body;
            try {
                body = (await response.json());
            }
            catch (error) {
                throw new Error('Token refresh failed');
            }
            return this.processDefaultAuthResponse(body, now);
        }
    }
    async getEffectiveDevicePermissions() {
        return await this.call('GET', 'v1/effective-device-permissions');
    }
    async getHandshakes(deviceId) {
        return await this.call('GET', `v1/controller/v0/handshakes?deviceId=${encodeURIComponent(deviceId)}`);
    }
    async getActivateCommands(deviceId) {
        return await this.call('GET', `v1/controller/v0/commands/activate-device?deviceId=${encodeURIComponent(deviceId)}`);
    }
}
exports.BoldApi = BoldApi;
//# sourceMappingURL=api.js.map