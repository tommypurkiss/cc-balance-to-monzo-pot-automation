import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export function encrypt(text: string, key: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  // Combine IV + tag + encrypted data
  return iv.toString('hex') + tag.toString('hex') + encrypted;
}

export function decrypt(encryptedData: string, key: string): string {
  const iv = Buffer.from(encryptedData.slice(0, IV_LENGTH * 2), 'hex');
  const tag = Buffer.from(
    encryptedData.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2),
    'hex'
  );
  const encrypted = encryptedData.slice((IV_LENGTH + TAG_LENGTH) * 2);

  const decipher = createDecipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}
