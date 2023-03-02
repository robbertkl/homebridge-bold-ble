import { createCipheriv, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const randomBytesAsync = promisify(randomBytes);

export class BoldCryptor {
  private counter = 0;

  constructor(private key: Buffer, private nonce: Buffer) {}

  public static async random(size: number): Promise<Buffer> {
    return await randomBytesAsync(size);
  }

  public async process(bytes: Buffer): Promise<Buffer> {
    const iv = Buffer.concat([this.nonce, Buffer.from([0, 0, this.counter])]);
    const cipher = createCipheriv('aes-128-ctr', this.key, iv);
    this.counter += Math.ceil(bytes.length / 16);
    return Buffer.concat([cipher.update(bytes), cipher.final()]);
  }
}
