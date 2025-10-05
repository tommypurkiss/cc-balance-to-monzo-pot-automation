import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as crypto from 'crypto';

const encryptionKey = defineSecret('ENCRYPTION_KEY');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

/**
 * Encrypt a string using AES-256-GCM
 */
function encrypt(text: string, key: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, 'sha512');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

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
function decrypt(encryptedData: string, key: string): string {
  const buffer = Buffer.from(encryptedData, 'base64');

  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = buffer.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, 'sha512');
  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * HTTP function for encryption/decryption operations
 */
export const encryptionService = onRequest(
  {
    secrets: [encryptionKey],
    region: 'europe-west2',
  },
  async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { operation, data } = req.body;

      if (!operation || !data) {
        res.status(400).json({ error: 'Missing operation or data' });
        return;
      }

      const key = encryptionKey.value();

      switch (operation) {
        case 'encrypt':
          if (typeof data !== 'string') {
            res
              .status(400)
              .json({ error: 'Data must be a string for encryption' });
            return;
          }
          const encrypted = encrypt(data, key);
          res.json({ result: encrypted });
          break;

        case 'decrypt':
          if (typeof data !== 'string') {
            res
              .status(400)
              .json({ error: 'Data must be a string for decryption' });
            return;
          }
          const decrypted = decrypt(data, key);
          res.json({ result: decrypted });
          break;

        default:
          res
            .status(400)
            .json({ error: 'Invalid operation. Use "encrypt" or "decrypt"' });
      }
    } catch (error) {
      console.error('Encryption service error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);
