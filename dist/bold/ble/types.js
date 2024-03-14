"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoldBlePacketTypes = void 0;
exports.BoldBlePacketTypes = {
    // Generic success packet.
    ResultSuccess: 0x00,
    // Handshake packets.
    StartHandshake: 0xa0,
    HandshakeResponse: 0xa1,
    HandshakeClientResponse: 0xa2,
    HandshakeFinishedResponse: 0xa3,
    // Command packets.
    Command: 0xa4,
    CommandAck: 0xa5,
    // Local packets (Connect Hub getting APs and setting wifi credentials).
    LocalCommand: 0xa6,
    LocalCommandResponse: 0xa7,
    // Message packets.
    DeliverMessages: 0xb0,
    // Dialog packets (pairing for installation, time sync).
    DialogServer: 0xc0,
    DialogDevice: 0xc1,
    // Event packets.
    Event: 0xd0,
    EventAck: 0xd1,
    EventAckResponse: 0xd2,
    // Error packets (single-byte packets, no payload).
    ClientBlocked: 0xfd,
    HandshakeExpired: 0xfe,
    EncryptionError: 0xff, // lock => app
};
//# sourceMappingURL=types.js.map