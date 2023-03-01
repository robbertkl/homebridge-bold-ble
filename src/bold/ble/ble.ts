import noble from '@abandonware/noble';

import { BoldApiCommand, BoldApiHandshake } from '../api/index.js';
import { BoldCryptor } from './cryptor.js';
import { BoldBleDeviceInfo, BoldBlePacketType, BoldBlePacketTypes } from './types.js';

const SESAM_MANUFACTURER_ID = 0x065b;
const SESAM_SERVICE_UUID = 'fd30';
const NORDIC_UART_RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const NORDIC_UART_TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

const DEFAULT_DISCOVER_TIMEOUT = 30 * 1000;
const DEFAULT_ACTIVATE_TIMEOUT = 30 * 1000;

const runWithTimeout = async <T>(timeout: number, func: (signal: AbortSignal) => Promise<T>) => {
  const abortController = new AbortController();
  const timer = setTimeout(() => {
    abortController.abort();
  }, timeout);
  return func(abortController.signal).finally(() => {
    clearTimeout(timer);
  });
};

class BoldBleConnection {
  private receiveBuffer = Buffer.alloc(0);
  private cryptor?: BoldCryptor;

  private constructor(
    private readonly peripheral: noble.Peripheral,
    private readonly writeCharacteristic: noble.Characteristic,
    private readonly readCharacteristic: noble.Characteristic,
    private readonly signal: AbortSignal
  ) {
    if (peripheral.state !== 'connected') {
      throw new Error('Peripheral is not connected');
    }

    this.readCharacteristic.on('read', this.onBytesReceived.bind(this));
    this.readCharacteristic.notify(true);
  }

  public static async create(peripheral: noble.Peripheral, signal: AbortSignal): Promise<BoldBleConnection> {
    if (peripheral.state !== 'disconnected') {
      throw new Error('Cannot connect peripheral while it is not yet disconnected');
    }

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        peripheral.removeListener('connect', onConnect);
        signal.removeEventListener('abort', onAbort);
      };

      const onConnect = () => {
        cleanup();
        resolve();
      };

      const onAbort = () => {
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

    let writeCharacteristic: noble.Characteristic | undefined;
    let readCharacteristic: noble.Characteristic | undefined;
    for (const characteristic of characteristics) {
      if (characteristic.uuid === NORDIC_UART_RX_CHARACTERISTIC_UUID.replace(/-/g, '').toLowerCase()) {
        writeCharacteristic = characteristic;
      } else if (characteristic.uuid === NORDIC_UART_TX_CHARACTERISTIC_UUID.replace(/-/g, '').toLowerCase()) {
        readCharacteristic = characteristic;
      }
    }

    if (!writeCharacteristic || !readCharacteristic) {
      throw new Error('Could not find Nordic UART characteristics on peripheral');
    }

    return new this(peripheral, writeCharacteristic, readCharacteristic, signal);
  }

  public async disconnect() {
    if (this.peripheral.state === 'disconnected') {
      return;
    }
    await this.peripheral.disconnectAsync();
  }

  private onBytesReceived(data: Buffer, isNotification: boolean) {
    if (!isNotification) {
      return;
    }

    this.receiveBuffer = this.receiveBuffer.length > 0 ? Buffer.concat([this.receiveBuffer, data]) : data;
    while (this.receiveBuffer.length > 0) {
      const type = this.receiveBuffer[0] as BoldBlePacketType;
      let payload: Buffer;
      if (type >= 0xf0) {
        payload = Buffer.alloc(0);
        this.receiveBuffer = this.receiveBuffer.subarray(1);
      } else {
        if (this.receiveBuffer.length < 3) {
          break;
        }
        const size = this.receiveBuffer[1]! | (this.receiveBuffer[2]! << 8);
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

  private onPacketReceived: ((type: BoldBlePacketType, payload: Buffer) => void) | undefined;

  public async call(type: BoldBlePacketType, payload: Buffer, replyType: BoldBlePacketType): Promise<Buffer> {
    let processReply = (reply: Buffer): Buffer | Promise<Buffer> => reply;

    if (type < BoldBlePacketTypes.StartHandshake || type > BoldBlePacketTypes.HandshakeFinishedResponse) {
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

    return new Promise<Buffer>((resolve, reject) => {
      const cleanup = () => {
        this.onPacketReceived = undefined;
        this.signal.removeEventListener('abort', onAbort);
      };

      this.onPacketReceived = (type, payload) => {
        if (type === BoldBlePacketTypes.Event) {
          // Ignore event packets that can come in the middle of a conversation.
          return;
        }

        cleanup();
        switch (type) {
          case replyType:
            resolve(payload);
            break;
          case BoldBlePacketTypes.ClientBlocked:
            reject(new Error('Received error from peripheral: Client blocked'));
            break;
          case BoldBlePacketTypes.HandshakeExpired:
            reject(new Error('Received error from peripheral: Handshake expired'));
            break;
          case BoldBlePacketTypes.EncryptionError:
            reject(new Error('Received error from peripheral: Encryption error'));
            break;
          default:
            reject(new Error(`Unexpected reply from peripheral (received ${type} instead of ${replyType})`));
        }
      };

      const onAbort = () => {
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

  public async performHandshake(handshake: BoldApiHandshake) {
    const handshakePayload = Buffer.from(handshake.payload, 'base64');
    const handshakeKey = Buffer.from(handshake.handshakeKey, 'base64');

    const handshakeResponse = await this.call(
      BoldBlePacketTypes.StartHandshake,
      handshakePayload,
      BoldBlePacketTypes.HandshakeResponse
    );

    const nonce = handshakeResponse.subarray(0, 13);
    const serverChallenge = handshakeResponse.subarray(13);

    const handshakeCryptor = new BoldCryptor(handshakeKey, nonce);
    const encryptedChallenge = await handshakeCryptor.process(serverChallenge);
    const clientChallenge = await BoldCryptor.random(8);
    const clientResponse = Buffer.concat([encryptedChallenge, clientChallenge]);
    const encryptedClientResponse = await handshakeCryptor.process(clientResponse);

    const handshakeFinishedResponse = await this.call(
      BoldBlePacketTypes.HandshakeClientResponse,
      encryptedClientResponse,
      BoldBlePacketTypes.HandshakeFinishedResponse
    );

    this.cryptor = new BoldCryptor(clientResponse, nonce);
    const serverResponse = await this.cryptor.process(handshakeFinishedResponse);
    if (serverResponse[0] !== 0 || Buffer.compare(serverResponse.subarray(1), clientChallenge) !== 0) {
      throw new Error('Handshake failed');
    }
  }
}

export class BoldBle {
  private async waitForBluetooth(signal: AbortSignal) {
    if (noble.state === 'poweredOn') {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        noble.removeListener('stateChange', onStateChange);
        signal.removeEventListener('abort', onAbort);
      };

      const onStateChange = (state: string) => {
        if (state === 'poweredOn') {
          cleanup();
          resolve();
        }
      };

      const onAbort = () => {
        cleanup();
        reject(new Error('Timed out while waiting for Bluetooth to turn on'));
      };

      noble.on('stateChange', onStateChange);

      if (signal.aborted) {
        onAbort();
      }
      signal.addEventListener('abort', onAbort);
    });
  }

  public async discoverBoldPeripherals(
    deviceIds?: number[],
    timeout = DEFAULT_DISCOVER_TIMEOUT
  ): Promise<Map<number, noble.Peripheral | null>> {
    const peripherals = new Map<number, noble.Peripheral | null>(
      deviceIds && deviceIds.map(deviceId => [deviceId, null])
    );
    if (deviceIds && deviceIds.length === 0) {
      return peripherals;
    }

    return runWithTimeout(timeout, async signal => {
      await this.waitForBluetooth(signal);
      return new Promise(resolve => {
        const done = () => {
          noble.stopScanning();
          noble.removeListener('discover', onDiscover);
          resolve(peripherals);
        };

        const onDiscover = (peripheral: noble.Peripheral) => {
          try {
            const deviceInfo = this.getDeviceInfo(peripheral);
            peripherals.set(deviceInfo.deviceId, peripheral);
            if (deviceIds && !deviceIds.some(deviceId => !peripherals.get(deviceId))) {
              done();
            }
          } catch (error: unknown) {
            // Ignore Bold peripheral with invalid manufacturer data.
          }
        };

        if (signal.aborted) {
          done();
        }
        signal.addEventListener('abort', done);

        noble.on('discover', onDiscover);
        noble.startScanning([SESAM_SERVICE_UUID], false);
      });
    });
  }

  public getDeviceInfo(peripheral: noble.Peripheral): BoldBleDeviceInfo {
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

  private async withEncryptedConnection<T>(
    peripheral: noble.Peripheral,
    handshake: BoldApiHandshake,
    timeout: number,
    func: (connection: BoldBleConnection) => T
  ) {
    return runWithTimeout(timeout, async signal => {
      const connection = await BoldBleConnection.create(peripheral, signal);
      await connection.performHandshake(handshake);

      try {
        if (signal.aborted) {
          throw new Error('Timed out after handshake');
        }
        return await func(connection);
      } finally {
        await connection.disconnect();
      }
    });
  }

  public async activateLock(
    peripheral: noble.Peripheral,
    handshake: BoldApiHandshake,
    activateCommand: BoldApiCommand,
    timeout: number = DEFAULT_ACTIVATE_TIMEOUT
  ): Promise<number> {
    return this.withEncryptedConnection(peripheral, handshake, timeout, async connection => {
      const commandPayload = Buffer.from(activateCommand.payload, 'base64');
      const commandAck = await connection.call(
        BoldBlePacketTypes.Command,
        commandPayload,
        BoldBlePacketTypes.CommandAck
      );

      const commandResult = commandAck.readUInt8(0);
      if (commandResult === 0xf0) {
        throw new Error('Access denied');
      } else if (commandResult !== 0) {
        throw new Error('Unexpected result from activate command');
      }

      const activationTime = commandAck.readUInt16LE(1);
      return activationTime;
    });
  }
}
