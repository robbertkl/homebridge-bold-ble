export declare type BoldBleDeviceInfo = {
    protocolVersion: number;
    type: number;
    model: number;
    deviceId: number;
    isInstallable: boolean;
    eventsAvailable: boolean;
    shouldTimeSync: boolean;
    isInDFUMode: boolean;
};
export declare const BoldBlePacketTypes: {
    readonly ResultSuccess: 0;
    readonly StartHandshake: 160;
    readonly HandshakeResponse: 161;
    readonly HandshakeClientResponse: 162;
    readonly HandshakeFinishedResponse: 163;
    readonly Command: 164;
    readonly CommandAck: 165;
    readonly LocalCommand: 166;
    readonly LocalCommandResponse: 167;
    readonly DeliverMessages: 176;
    readonly DialogServer: 192;
    readonly DialogDevice: 193;
    readonly Event: 208;
    readonly EventAck: 209;
    readonly EventAckResponse: 210;
    readonly ClientBlocked: 253;
    readonly HandshakeExpired: 254;
    readonly EncryptionError: 255;
};
export declare type BoldBlePacketType = typeof BoldBlePacketTypes[keyof typeof BoldBlePacketTypes];
//# sourceMappingURL=types.d.ts.map