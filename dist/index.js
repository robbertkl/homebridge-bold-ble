"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("node:fs/promises"));
const PLATFORM_NAME = 'BoldBLE';
const PLUGIN_NAME = 'homebridge-bold-ble';
const HOUR = 60 * 60 * 1000;
const UPDATE_INTERVAL = 1 * HOUR;
const DEVICES_UDPATE_INTERVAL = 24 * HOUR;
const HANDSHAKE_UPDATE_MARGIN = 24 * HOUR;
const COMMAND_UPDATE_MARGIN = 24 * HOUR;
const BOLD_SMART_CYLINDER_DEVICE_TYPE = 1;
exports.default = (homebridge) => {
    homebridge.registerPlatform(PLATFORM_NAME, BoldBlePlatform);
};
class BoldBlePlatform {
    constructor(log, config, homebridge) {
        this.log = log;
        this.homebridge = homebridge;
        this.Characteristic = this.homebridge.hap.Characteristic;
        this.locks = new Map();
        let updateTimer;
        homebridge.on("didFinishLaunching" /* DID_FINISH_LAUNCHING */, async () => {
            try {
                try {
                    await Promise.resolve().then(() => __importStar(require('@abandonware/noble')));
                }
                catch (error) {
                    throw new Error('Could not load Bluetooth library; possibly unsupported on your platform');
                }
                const { BoldApi, BoldBle } = await Promise.resolve().then(() => __importStar(require('./bold')));
                this.api = new BoldApi(config);
                this.ble = new BoldBle(log);
                this.api.on('refresh', this.onApiTokenRefresh.bind(this));
                await this.update(true);
                updateTimer = setInterval(this.update.bind(this), UPDATE_INTERVAL);
            }
            catch (error) {
                this.log.error(error.message);
            }
        });
        homebridge.on("shutdown" /* SHUTDOWN */, () => {
            if (updateTimer) {
                clearInterval(updateTimer);
            }
        });
    }
    configureAccessory(accessory) {
        const device = accessory.context;
        if (!device.id || !device.name) {
            this.log.warn(`Device not found for accessory ${accessory.UUID}. Removing...`);
            this.homebridge.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            return;
        }
        this.log.info(`Configuring accessory for device ${device.id} (${device.name})`);
        this.locks.set(device.id, {
            accessory,
            state: 'deactivated',
        });
        let lockService = accessory.getService(this.homebridge.hap.Service.LockMechanism);
        if (!lockService) {
            lockService = accessory.addService(this.homebridge.hap.Service.LockMechanism);
        }
        const currentState = lockService.getCharacteristic(this.Characteristic.LockCurrentState);
        const targetState = lockService.getCharacteristic(this.Characteristic.LockTargetState);
        currentState.onGet(this.getCurrentLockState.bind(this, device.id));
        targetState.onGet(this.getTargetLockState.bind(this, device.id));
        targetState.onSet(this.setTargetLockState.bind(this, device.id));
        let informationService = accessory.getService(this.homebridge.hap.Service.AccessoryInformation);
        if (!informationService) {
            informationService = accessory.addService(this.homebridge.hap.Service.AccessoryInformation);
        }
        informationService.getCharacteristic(this.Characteristic.Name).onGet(() => device.name || 'Bold Lock');
        informationService.getCharacteristic(this.Characteristic.Manufacturer).onGet(() => device.model.make || 'Bold');
        informationService.getCharacteristic(this.Characteristic.Model).onGet(() => device.model.model || 'Lock');
        informationService
            .getCharacteristic(this.Characteristic.SerialNumber)
            .onGet(() => { var _a; return (_a = device.serial) !== null && _a !== void 0 ? _a : `${device.type.id}-${device.model.id}-${device.owner.organizationId}-${device.id}`; });
        informationService
            .getCharacteristic(this.Characteristic.FirmwareRevision)
            .onGet(() => `${device.actualFirmwareVersion || 'Unknown'}`);
    }
    getCurrentLockState(deviceId) {
        const lock = this.locks.get(deviceId);
        if (!lock) {
            this.log.warn(`GetCurrentLockState requested for device ${deviceId}, but no such accessory`);
            throw new this.homebridge.hap.HapStatusError(-70409 /* RESOURCE_DOES_NOT_EXIST */);
        }
        switch (lock.state) {
            case 'deactivated':
                return this.Characteristic.LockCurrentState.SECURED;
            case 'activating':
                return this.Characteristic.LockCurrentState.SECURED;
            case 'activated':
                return this.Characteristic.LockCurrentState.UNSECURED;
            default:
                return this.Characteristic.LockCurrentState.UNKNOWN;
        }
    }
    getTargetLockState(deviceId) {
        const lock = this.locks.get(deviceId);
        if (!lock) {
            this.log.warn(`GetTargetLockState requested for device ${deviceId}, but no such accessory`);
            throw new this.homebridge.hap.HapStatusError(-70409 /* RESOURCE_DOES_NOT_EXIST */);
        }
        switch (lock.state) {
            case 'deactivated':
                return this.Characteristic.LockTargetState.SECURED;
            case 'activating':
                return this.Characteristic.LockTargetState.UNSECURED;
            case 'activated':
                return this.Characteristic.LockTargetState.UNSECURED;
            default:
                return this.Characteristic.LockTargetState.SECURED;
        }
    }
    async setTargetLockState(deviceId, value) {
        this.log.info(`setTargetLockState(${deviceId}, ${value})`);
        const lock = this.locks.get(deviceId);
        if (!lock) {
            this.log.warn(`SetTargetLockState requested for device ${deviceId}, but no such accessory`);
            throw new this.homebridge.hap.HapStatusError(-70409 /* RESOURCE_DOES_NOT_EXIST */);
        }
        const service = lock.accessory.getService(this.homebridge.hap.Service.LockMechanism);
        const currentState = service === null || service === void 0 ? void 0 : service.getCharacteristic(this.Characteristic.LockCurrentState);
        const targetState = service === null || service === void 0 ? void 0 : service.getCharacteristic(this.Characteristic.LockTargetState);
        if (value === this.Characteristic.LockTargetState.SECURED) {
            // The lock deactivates by itself, so there's no way to "secure" a lock on command.
            targetState === null || targetState === void 0 ? void 0 : targetState.updateValue(this.Characteristic.LockTargetState.SECURED);
            return;
        }
        if (!lock.handshake || !lock.activateCommand) {
            this.log.error(`Cannot activate lock for device ${deviceId} due to missing handshake or command`);
            throw new this.homebridge.hap.HapStatusError(-70402 /* SERVICE_COMMUNICATION_FAILURE */);
        }
        if (!lock.peripheral) {
            this.log.error(`Cannot activate lock for undiscovered device ${deviceId} (out of Bluetooth range?)`);
            throw new this.homebridge.hap.HapStatusError(-70402 /* SERVICE_COMMUNICATION_FAILURE */);
        }
        if (lock.state === 'activating' || lock.state === 'activated') {
            this.log.warn(`Skipping lock activation for device ${deviceId}, it's already ${lock.state}`);
            throw new this.homebridge.hap.HapStatusError(-70412 /* NOT_ALLOWED_IN_CURRENT_STATE */);
        }
        this.log.info('lock.state = activating');
        lock.state = 'activating';
        targetState === null || targetState === void 0 ? void 0 : targetState.updateValue(this.Characteristic.LockTargetState.UNSECURED);
        if (!this.ble) {
            this.log.error(`Cannot activate lock for device ${deviceId} because Bluetooth library was not loaded`);
            throw new this.homebridge.hap.HapStatusError(-70402 /* SERVICE_COMMUNICATION_FAILURE */);
        }
        let activationTime;
        try {
            this.log.info('Activating lock...');
            activationTime = await this.ble.activateLock(lock.peripheral, lock.handshake, lock.activateCommand);
            this.log.info(`Activated lock for device ${deviceId}, will auto-deactivate after ${activationTime}s`);
        }
        catch (error) {
            let hapStatus = -70402 /* SERVICE_COMMUNICATION_FAILURE */;
            if (error instanceof Error) {
                const message = error.message;
                this.log.error(`Could not activate lock for device ${deviceId}: ${message}`);
                if (message.match(/time(d )?out/i)) {
                    hapStatus = -70408 /* OPERATION_TIMED_OUT */;
                }
                else if (message.match(/not yet disconnected/i)) {
                    hapStatus = -70403 /* RESOURCE_BUSY */;
                }
            }
            else {
                this.log.error(`Could not activate lock for device ${deviceId}`);
            }
            throw new this.homebridge.hap.HapStatusError(hapStatus);
        }
        this.log.info('lock.state = activated');
        lock.state = 'activated';
        currentState === null || currentState === void 0 ? void 0 : currentState.updateValue(this.Characteristic.LockTargetState.UNSECURED);
        setTimeout(() => {
            this.log.info('lock.state = deactivated');
            lock.state = 'deactivated';
            currentState === null || currentState === void 0 ? void 0 : currentState.updateValue(this.Characteristic.LockTargetState.SECURED);
            targetState === null || targetState === void 0 ? void 0 : targetState.updateValue(this.Characteristic.LockTargetState.SECURED);
        }, activationTime * 1000);
    }
    async fetchCompatibleDevices() {
        var _a, _b;
        const potentialDevices = (_b = (await ((_a = this.api) === null || _a === void 0 ? void 0 : _a.getEffectiveDevicePermissions()))) !== null && _b !== void 0 ? _b : [];
        const devices = new Map();
        for (const device of potentialDevices) {
            if (!device.id) {
                this.log.warn('Skipping device without device ID');
            }
            else if (!device.name) {
                this.log.warn(`Skipping device ${device.id}: missing device name`);
            }
            else if (device.type.id !== BOLD_SMART_CYLINDER_DEVICE_TYPE) {
                this.log.warn(`Skipping device ${device.id}: not a Bold Smart Cylinder`);
            }
            else if (!device.permissions.some(permission => permission.devicePermission === 'UseDevice')) {
                this.log.warn(`Skipping device ${device.id}: no permission to use`);
            }
            else {
                devices.set(device.id, device);
            }
        }
        return devices;
    }
    async discoverCompatiblePeripherals(deviceIds) {
        const peripherals = new Map();
        if (!this.ble) {
            return peripherals;
        }
        const potentialPeripherals = await this.ble.discoverBoldPeripherals(deviceIds);
        for (const [deviceId, peripheral] of potentialPeripherals) {
            if (!peripheral) {
                this.log.warn(`Unable to discover peripheral for device ${deviceId}`);
                continue;
            }
            let deviceInfo;
            try {
                deviceInfo = this.ble.getDeviceInfo(peripheral);
            }
            catch (error) {
                this.log.warn(`Skipping discovered peripheral for device ${deviceId}: invalid manufacturer data`);
                continue;
            }
            if (deviceInfo.type !== BOLD_SMART_CYLINDER_DEVICE_TYPE) {
                this.log.warn(`Skipping discovered peripheral for device ${deviceId}: Device is not a Bold Smart Cylinder`);
            }
            else if (deviceInfo.isInDFUMode) {
                this.log.warn(`Skipping discovered peripheral for device ${deviceId}: Device is in DFU mode`);
            }
            else if (deviceInfo.isInstallable) {
                this.log.warn(`Skipping discovered peripheral for device ${deviceId}: Device is not yet installed`);
            }
            else {
                this.log.info(`Discovered peripheral for device ${deviceId} with ${peripheral.rssi} dBm RSSI`);
                peripherals.set(deviceId, peripheral);
            }
        }
        return peripherals;
    }
    async onApiTokenRefresh(newAuth, oldAuth) {
        this.log.debug('Refreshed API tokens');
        try {
            const buffer = await fs.readFile(this.homebridge.user.configPath());
            const json = buffer.toString('utf8');
            const fullConfig = JSON.parse(json);
            let platformIndex = fullConfig.platforms.findIndex(platform => platform.platform === PLATFORM_NAME && platform.accessToken === (oldAuth === null || oldAuth === void 0 ? void 0 : oldAuth.accessToken));
            if (platformIndex < 0) {
                this.log.warn(`Could not find platform with current access token; using first ${PLATFORM_NAME} entry`);
                platformIndex = fullConfig.platforms.findIndex(platform => platform.platform === PLATFORM_NAME);
            }
            if (platformIndex < 0) {
                this.log.error(`Could not find ${PLATFORM_NAME} entry in config; not writing refreshed tokens`);
                return;
            }
            const currentConfig = fullConfig.platforms[platformIndex];
            delete currentConfig.refreshURL;
            fullConfig.platforms[platformIndex] = { ...currentConfig, ...newAuth };
            await fs.writeFile(this.homebridge.user.configPath(), JSON.stringify(fullConfig, null, 4));
        }
        catch (error) {
            this.log.error('Error writing refreshed tokens to config');
        }
    }
    async update(force = false) {
        try {
            await this.updateDevices(force);
        }
        catch (error) {
            this.log.error(error.message);
        }
        try {
            await this.updateHandshakes(force);
        }
        catch (error) {
            this.log.error(error.message);
        }
        try {
            await this.updateCommands(force);
        }
        catch (error) {
            this.log.error(error.message);
        }
        try {
            await this.discoverPeripherals();
        }
        catch (error) {
            this.log.error(error.message);
        }
    }
    async updateDevices(forceUpdate = false) {
        if (!forceUpdate &&
            this.lastDevicesCheck &&
            new Date().getTime() - this.lastDevicesCheck.getTime() < DEVICES_UDPATE_INTERVAL) {
            return;
        }
        const devices = await this.fetchCompatibleDevices();
        const newDeviceIds = Array.from(devices.keys());
        const oldDeviceIds = Array.from(this.locks.keys());
        const deviceIdsToRemove = oldDeviceIds.filter(id => !newDeviceIds.includes(id));
        const deviceIdsToAdd = newDeviceIds.filter(id => !oldDeviceIds.includes(id));
        const deviceIdsToUpdate = oldDeviceIds.filter(id => newDeviceIds.includes(id));
        const accessoriesToUnregister = [];
        for (const deviceId of deviceIdsToRemove) {
            this.log.info(`Removing accessory for device ${deviceId}`);
            const lock = this.locks.get(deviceId);
            this.locks.delete(deviceId);
            accessoriesToUnregister.push(lock.accessory);
        }
        this.homebridge.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, accessoriesToUnregister);
        const peripherals = await this.discoverCompatiblePeripherals(deviceIdsToAdd);
        const accessoriesToRegister = [];
        for (const deviceId of deviceIdsToAdd) {
            // We're only going to add accessories for devices that are in Bluetooth range.
            const peripheral = peripherals.get(deviceId);
            if (!peripheral) {
                continue;
            }
            const device = devices.get(deviceId);
            const uuid = this.homebridge.hap.uuid.generate(`BoldSmartLock-BLE-${device.id}`);
            const accessory = new this.homebridge.platformAccessory(device.name, uuid, 6 /* DOOR_LOCK */);
            accessory.context = device;
            this.configureAccessory(accessory);
            this.locks.get(deviceId).peripheral = peripheral;
            accessoriesToRegister.push(accessory);
        }
        this.homebridge.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, accessoriesToRegister);
        const accessoriesToUpdate = [];
        for (const deviceId of deviceIdsToUpdate) {
            const lock = this.locks.get(deviceId);
            lock.accessory.context = devices.get(deviceId);
            accessoriesToUpdate.push(lock.accessory);
        }
        this.homebridge.updatePlatformAccessories(accessoriesToUpdate);
    }
    async discoverPeripherals() {
        // Discovered peripherals for configured accessories for which we don't have a peripheral.
        // This happens when Homebridge starts and restores previously added accessories from cache.
        const deviceIds = Array.from(this.locks.entries())
            .filter(([, lock]) => !lock.peripheral)
            .map(([deviceId]) => deviceId);
        const peripherals = await this.discoverCompatiblePeripherals(deviceIds);
        for (const deviceId of deviceIds) {
            const lock = this.locks.get(deviceId);
            const peripheral = peripherals.get(deviceId);
            if (lock && peripheral) {
                lock.peripheral = peripheral;
            }
        }
    }
    async updateHandshakes(forceUpdate = false) {
        var _a, _b;
        for (const [deviceId, lock] of this.locks) {
            if (forceUpdate ||
                !lock.handshake ||
                new Date(lock.handshake.expiration).getTime() - new Date().getTime() < HANDSHAKE_UPDATE_MARGIN) {
                try {
                    const handshakes = (_b = (await ((_a = this.api) === null || _a === void 0 ? void 0 : _a.getHandshakes(deviceId)))) !== null && _b !== void 0 ? _b : [];
                    const handshake = handshakes.shift();
                    if (handshake) {
                        this.log.debug(`Updated handshake for device ${deviceId}`);
                        lock.handshake = handshake;
                    }
                    else {
                        this.log.warn(`Did not receive any handshake for device ${deviceId}`);
                    }
                }
                catch (error) {
                    this.log.error(error.message);
                }
            }
        }
    }
    async updateCommands(forceUpdate = false) {
        var _a, _b;
        for (const [deviceId, lock] of this.locks) {
            if (forceUpdate ||
                !lock.activateCommand ||
                new Date(lock.activateCommand.expiration).getTime() - new Date().getTime() < COMMAND_UPDATE_MARGIN) {
                try {
                    const commands = (_b = (await ((_a = this.api) === null || _a === void 0 ? void 0 : _a.getActivateCommands(deviceId)))) !== null && _b !== void 0 ? _b : [];
                    const command = commands.shift();
                    if (command) {
                        this.log.debug(`Updated activate-command for device ${deviceId}`);
                        lock.activateCommand = command;
                    }
                    else {
                        this.log.warn(`Did not receive any activate-command for device ${deviceId}`);
                    }
                }
                catch (error) {
                    this.log.error(error.message);
                }
            }
        }
    }
}
//# sourceMappingURL=index.js.map