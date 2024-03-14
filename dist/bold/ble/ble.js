"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoldBle = void 0;
const noble_1 = __importDefault(require("@abandonware/noble"));
const cryptor_1 = require("./cryptor");
const types_1 = require("./types");
const SESAM_MANUFACTURER_ID = 0x065b;
const SESAM_SERVICE_UUID = 'fd30';
const NORDIC_UART_RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const NORDIC_UART_TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const DEFAULT_DISCOVER_TIMEOUT = 30 * 1000;
const DEFAULT_ACTIVATE_TIMEOUT = 30 * 1000;
const runWithTimeout = async (timeout, func, log) => {
    log.info(`runWithTimeout(${timeout})`);
    const abortController = new AbortController();
    const timer = setTimeout(() => {
        abortController.abort();
    }, timeout);
    return func(abortController.signal).finally(() => {
        clearTimeout(timer);
    });
};
class BoldBleConnection {
    constructor(peripheral, writeCharacteristic, readCharacteristic, signal, log) {
        this.peripheral = peripheral;
        this.writeCharacteristic = writeCharacteristic;
        this.readCharacteristic = readCharacteristic;
        this.signal = signal;
        this.log = log;
        this.receiveBuffer = Buffer.alloc(0);
        if (peripheral.state !== 'connected') {
            throw new Error('Peripheral is not connected');
        }
        this.readCharacteristic.on('read', this.onBytesReceived.bind(this));
    }
    static async create(peripheral, signal, log) {
        log.info(`BoldBleConnection.create(), peripheral.state=${peripheral.state}`);
        if (peripheral.state !== 'disconnected') {
            throw new Error('Cannot connect peripheral while it is not yet disconnected');
        }
        await new Promise((resolve, reject) => {
            const cleanup = () => {
                peripheral.removeListener('connect', onConnect);
                signal.removeEventListener('abort', onAbort);
            };
            const onConnect = () => {
                cleanup();
                resolve();
            };
            const onAbort = () => {
                log.info('BoldBleConnection.create -> onAbort');
                // Skip cancelling because cancelConnect() seems broken in noble! :-(
                // peripheral.cancelConnect();
                cleanup();
                reject(new Error('Timed out while connecting'));
            };
            peripheral.on('connect', onConnect);
            peripheral.connect();
            if (signal.aborted) {
                onAbort();
            }
            signal.addEventListener('abort', onAbort);
        });
        const { characteristics } = await peripheral.discoverAllServicesAndCharacteristicsAsync();
        let writeCharacteristic;
        let readCharacteristic;
        for (const characteristic of characteristics) {
            if (characteristic.uuid === NORDIC_UART_RX_CHARACTERISTIC_UUID.replace(/-/g, '').toLowerCase()) {
                writeCharacteristic = characteristic;
            }
            else if (characteristic.uuid === NORDIC_UART_TX_CHARACTERISTIC_UUID.replace(/-/g, '').toLowerCase()) {
                readCharacteristic = characteristic;
            }
        }
        if (!writeCharacteristic || !readCharacteristic) {
            throw new Error('Could not find Nordic UART characteristics on peripheral');
        }
        await readCharacteristic.notifyAsync(true);
        return new this(peripheral, writeCharacteristic, readCharacteristic, signal, log);
    }
    async disconnect() {
        this.log.info(`BoldBleConnection.disconnect(), peripheral.state=${this.peripheral.state}`);
        if (this.peripheral.state === 'disconnected') {
            return;
        }
        await this.peripheral.disconnectAsync();
    }
    onBytesReceived(data, isNotification) {
        if (!isNotification) {
            return;
        }
        this.log.info(`BoldBleConnection.onBytesReceived(<${data.byteLength}>), peripheral.state=${this.peripheral.state}`);
        this.receiveBuffer = this.receiveBuffer.length > 0 ? Buffer.concat([this.receiveBuffer, data]) : data;
        while (this.receiveBuffer.length > 0) {
            const type = this.receiveBuffer[0];
            let payload;
            if (type >= 0xf0) {
                payload = Buffer.alloc(0);
                this.receiveBuffer = this.receiveBuffer.subarray(1);
            }
            else {
                if (this.receiveBuffer.length < 3) {
                    break;
                }
                const size = this.receiveBuffer[1] | (this.receiveBuffer[2] << 8);
                if (this.receiveBuffer.length < size + 3) {
                    break;
                }
                payload = this.receiveBuffer.subarray(3, size + 3);
                this.receiveBuffer = this.receiveBuffer.subarray(size + 3);
            }
            if (this.onPacketReceived) {
                this.onPacketReceived(type, payload);
            }
        }
    }
    async call(type, payload, replyType) {
        this.log.info(`BoldBleConnection.onPacketReceived(${type}, <${payload.byteLength}>, ${replyType}), peripheral.state=${this.peripheral.state}`);
        let processReply = (reply) => reply;
        if (type < types_1.BoldBlePacketTypes.StartHandshake || type > types_1.BoldBlePacketTypes.HandshakeFinishedResponse) {
            // For non-handshake packets we need to encrypt the payload and decrypt the reply.
            if (!this.cryptor) {
                throw new Error(`Call of type ${type} requires encryption, please perform handshake first`);
            }
            const cryptor = this.cryptor;
            payload = await cryptor.process(payload);
            processReply = reply => cryptor.process(reply);
        }
        if (this.signal.aborted) {
            throw new Error(`Timed out before making call of type ${type}`);
        }
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                this.onPacketReceived = undefined;
                this.signal.removeEventListener('abort', onAbort);
            };
            this.onPacketReceived = (type, payload) => {
                this.log.info(`BoldBleConnection.onPacketReceived(${type}, <${payload.byteLength}>), peripheral.state=${this.peripheral.state}`);
                if (type === types_1.BoldBlePacketTypes.Event) {
                    // Ignore event packets that can come in the middle of a conversation.
                    return;
                }
                cleanup();
                switch (type) {
                    case replyType:
                        resolve(payload);
                        break;
                    case types_1.BoldBlePacketTypes.ClientBlocked:
                        reject(new Error('Received error from peripheral: Client blocked'));
                        break;
                    case types_1.BoldBlePacketTypes.HandshakeExpired:
                        reject(new Error('Received error from peripheral: Handshake expired'));
                        break;
                    case types_1.BoldBlePacketTypes.EncryptionError:
                        reject(new Error('Received error from peripheral: Encryption error'));
                        break;
                    default:
                        reject(new Error(`Unexpected reply from peripheral (received ${type} instead of ${replyType})`));
                }
            };
            const onAbort = () => {
                this.log.info('BoldBleConnection.call -> onAbort');
                cleanup();
                reject(new Error(`Timed out while waiting for reply packet of type ${replyType}`));
            };
            const packet = Buffer.from([type, payload.length & 0xff, (payload.length >> 8) & 0xff, ...payload]);
            this.writeCharacteristic.write(packet, false);
            if (this.signal.aborted) {
                onAbort();
            }
            this.signal.addEventListener('abort', onAbort);
        }).then(processReply);
    }
    async performHandshake(handshake) {
        this.log.info(`BoldBleConnection.performHandshake(), peripheral.state=${this.peripheral.state}`);
        const handshakePayload = Buffer.from(handshake.payload, 'base64');
        const handshakeKey = Buffer.from(handshake.handshakeKey, 'base64');
        const handshakeResponse = await this.call(types_1.BoldBlePacketTypes.StartHandshake, handshakePayload, types_1.BoldBlePacketTypes.HandshakeResponse);
        const nonce = handshakeResponse.subarray(0, 13);
        const serverChallenge = handshakeResponse.subarray(13);
        const handshakeCryptor = new cryptor_1.BoldCryptor(handshakeKey, nonce);
        const encryptedChallenge = await handshakeCryptor.process(serverChallenge);
        const clientChallenge = await cryptor_1.BoldCryptor.random(8);
        const clientResponse = Buffer.concat([encryptedChallenge, clientChallenge]);
        const encryptedClientResponse = await handshakeCryptor.process(clientResponse);
        const handshakeFinishedResponse = await this.call(types_1.BoldBlePacketTypes.HandshakeClientResponse, encryptedClientResponse, types_1.BoldBlePacketTypes.HandshakeFinishedResponse);
        this.cryptor = new cryptor_1.BoldCryptor(clientResponse, nonce);
        const serverResponse = await this.cryptor.process(handshakeFinishedResponse);
        if (serverResponse[0] !== 0 || Buffer.compare(serverResponse.subarray(1), clientChallenge) !== 0) {
            throw new Error('Handshake failed');
        }
    }
}
class BoldBle {
    constructor(log) {
        this.log = log;
    }
    async waitForBluetooth(signal) {
        this.log.info('BoldBle.waitForBluetooth()');
        if (noble_1.default.state === 'poweredOn') {
            return;
        }
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                noble_1.default.removeListener('stateChange', onStateChange);
                signal.removeEventListener('abort', onAbort);
            };
            const onStateChange = (state) => {
                if (state === 'poweredOn') {
                    cleanup();
                    resolve();
                }
            };
            const onAbort = () => {
                this.log.info('BoldBle.waitForBluetooth -> onAbort');
                cleanup();
                reject(new Error('Timed out while waiting for Bluetooth to turn on'));
            };
            noble_1.default.on('stateChange', onStateChange);
            if (signal.aborted) {
                onAbort();
            }
            signal.addEventListener('abort', onAbort);
        });
    }
    async discoverBoldPeripherals(deviceIds, timeout = DEFAULT_DISCOVER_TIMEOUT) {
        this.log.info(`BoldBle.discoverBoldPeripherals(${deviceIds}, ${timeout})`);
        const peripherals = new Map(deviceIds && deviceIds.map(deviceId => [deviceId, null]));
        if (deviceIds && deviceIds.length === 0) {
            return peripherals;
        }
        return runWithTimeout(timeout, async (signal) => {
            await this.waitForBluetooth(signal);
            return new Promise(resolve => {
                const done = () => {
                    noble_1.default.stopScanning();
                    noble_1.default.removeListener('discover', onDiscover);
                    resolve(peripherals);
                };
                const onDiscover = (peripheral) => {
                    try {
                        const deviceInfo = this.getDeviceInfo(peripheral);
                        peripherals.set(deviceInfo.deviceId, peripheral);
                        if (deviceIds && !deviceIds.some(deviceId => !peripherals.get(deviceId))) {
                            done();
                        }
                    }
                    catch (error) {
                        // Ignore Bold peripheral with invalid manufacturer data.
                    }
                };
                if (signal.aborted) {
                    done();
                }
                signal.addEventListener('abort', done);
                noble_1.default.on('discover', onDiscover);
                noble_1.default.startScanning([SESAM_SERVICE_UUID], false);
            });
        }, this.log);
    }
    getDeviceInfo(peripheral) {
        this.log.info('BoldBle.getDeviceInfo()');
        const data = peripheral.advertisement.manufacturerData;
        if (data.length !== 14) {
            throw new Error('Incorrect length of manufacturer data');
        }
        const manufacturerId = data.readUInt16LE(0);
        if (manufacturerId !== SESAM_MANUFACTURER_ID) {
            throw new Error('Incorrect manufacturer ID');
        }
        const flags = data.readUInt8(13);
        return {
            protocolVersion: data.readUInt8(2),
            type: data.readUInt8(3),
            model: data.readUInt8(4),
            deviceId: Number(data.readBigUInt64LE(5)),
            isInstallable: (flags & 1) > 0,
            eventsAvailable: (flags & 2) > 0,
            shouldTimeSync: (flags & 4) > 0,
            isInDFUMode: (flags & 8) > 0,
        };
    }
    async withEncryptedConnection(peripheral, handshake, timeout, func) {
        this.log.info('BoldBle.withEncryptedConnection()');
        return runWithTimeout(timeout, async (signal) => {
            const connection = await BoldBleConnection.create(peripheral, signal, this.log);
            await connection.performHandshake(handshake);
            try {
                if (signal.aborted) {
                    throw new Error('Timed out after handshake');
                }
                return await func(connection);
            }
            finally {
                await connection.disconnect();
            }
        }, this.log);
    }
    async activateLock(peripheral, handshake, activateCommand, timeout = DEFAULT_ACTIVATE_TIMEOUT) {
        this.log.info('BoldBle.activateLock()');
        return this.withEncryptedConnection(peripheral, handshake, timeout, async (connection) => {
            const commandPayload = Buffer.from(activateCommand.payload, 'base64');
            const commandAck = await connection.call(types_1.BoldBlePacketTypes.Command, commandPayload, types_1.BoldBlePacketTypes.CommandAck);
            const commandResult = commandAck.readUInt8(0);
            if (commandResult === 0xf0) {
                throw new Error('Access denied');
            }
            else if (commandResult !== 0) {
                throw new Error('Unexpected result from activate command');
            }
            const activationTime = commandAck.readUInt16LE(1);
            return activationTime;
        });
    }
}
exports.BoldBle = BoldBle;
//# sourceMappingURL=ble.js.map