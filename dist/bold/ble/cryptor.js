"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoldCryptor = void 0;
const node_crypto_1 = require("node:crypto");
const node_util_1 = require("node:util");
const randomBytesAsync = (0, node_util_1.promisify)(node_crypto_1.randomBytes);
class BoldCryptor {
    constructor(key, nonce) {
        this.key = key;
        this.nonce = nonce;
        this.counter = 0;
    }
    static async random(size) {
        return await randomBytesAsync(size);
    }
    async process(bytes) {
        const iv = Buffer.concat([this.nonce, Buffer.from([0, 0, this.counter])]);
        const cipher = (0, node_crypto_1.createCipheriv)('aes-128-ctr', this.key, iv);
        this.counter += Math.ceil(bytes.length / 16);
        return Buffer.concat([cipher.update(bytes), cipher.final()]);
    }
}
exports.BoldCryptor = BoldCryptor;
//# sourceMappingURL=cryptor.js.map