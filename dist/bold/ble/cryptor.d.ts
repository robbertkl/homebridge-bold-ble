/// <reference types="node" />
export declare class BoldCryptor {
    private key;
    private nonce;
    private counter;
    constructor(key: Buffer, nonce: Buffer);
    static random(size: number): Promise<Buffer>;
    process(bytes: Buffer): Promise<Buffer>;
}
//# sourceMappingURL=cryptor.d.ts.map