import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

/**
 * Encrypt a string using AES-256-GCM
 */
export function encrypt(text: string, encryptionKey: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(
    encryptionKey,
    salt,
    100000,
    KEY_LENGTH,
    'sha512'
  );
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, 'hex'),
  ]).toString('base64');
}

/**
 * Decrypt a string using AES-256-GCM
 */
export function decrypt(encryptedData: string, encryptionKey: string): string {
  const buffer = Buffer.from(encryptedData, 'base64');

  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = buffer.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = crypto.pbkdf2Sync(
    encryptionKey,
    salt,
    100000,
    KEY_LENGTH,
    'sha512'
  );
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
