import { Peripheral } from '@abandonware/noble';
import { Logger } from 'homebridge';
import { BoldApiCommand, BoldApiHandshake } from '../api';
import { BoldBleDeviceInfo } from './types';
export declare class BoldBle {
    private readonly log;
    constructor(log: Logger);
    private waitForBluetooth;
    discoverBoldPeripherals(deviceIds?: number[], timeout?: number): Promise<Map<number, Peripheral | null>>;
    getDeviceInfo(peripheral: Peripheral): BoldBleDeviceInfo;
    private withEncryptedConnection;
    activateLock(peripheral: Peripheral, handshake: BoldApiHandshake, activateCommand: BoldApiCommand, timeout?: number): Promise<number>;
}
//# sourceMappingURL=ble.d.ts.map