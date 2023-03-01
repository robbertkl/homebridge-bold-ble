export type BoldBleDeviceInfo = {
  protocolVersion: number;
  type: number;
  model: number;
  deviceId: number;
  isInstallable: boolean;
  eventsAvailable: boolean;
  shouldTimeSync: boolean;
  isInDFUMode: boolean;
};

export const BoldBlePacketTypes = {
  // Generic success packet.
  ResultSuccess: 0x00,

  // Handshake packets.
  StartHandshake: 0xa0, // app => lock, payload = handshake.payload (57 bytes)
  HandshakeResponse: 0xa1, // lock => app, payload = nonce (13 bytes) + server challenge (8 bytes) (total 21 bytes)
  HandshakeClientResponse: 0xa2, // app => lock, payload = encrypted client response + client challenge (16 bytes)
  HandshakeFinishedResponse: 0xa3, // lock => app, payload = encrypted server response (9 bytes)

  // Command packets.
  Command: 0xa4, // app => lock, payload = encrypted command.payload (46 bytes)
  CommandAck: 0xa5, // lock => app, payload = encrypted result + activation time (4 bytes)

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
  ClientBlocked: 0xfd, // lock => app
  HandshakeExpired: 0xfe, // lock => app
  EncryptionError: 0xff, // lock => app
} as const;

export type BoldBlePacketType = typeof BoldBlePacketTypes[keyof typeof BoldBlePacketTypes];
