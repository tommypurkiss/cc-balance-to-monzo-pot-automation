import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { encryptionHelpers } from './encryptionHelpers';
import { info } from 'firebase-functions/logger';

const encryptionKey = defineSecret('ENCRYPTION_KEY');

/**
 * HTTP function for encryption/decryption operations
 */
export const encryptionService = onRequest(
  {
    secrets: [encryptionKey],
    region: 'europe-west2',
  },
  async (req, res) => {
    info('encryptionService - Request received');

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
      info('encryptionService - Operation:', operation);
      info('encryptionService - Data:', data);

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
          const encrypted = encryptionHelpers.encrypt(data, key);
          res.json({ result: encrypted });
          break;

        case 'decrypt':
          if (typeof data !== 'string') {
            res
              .status(400)
              .json({ error: 'Data must be a string for decryption' });
            return;
          }
          const decrypted = encryptionHelpers.decrypt(data, key);
          res.json({ result: decrypted });
          break;

        default:
          res
            .status(400)
            .json({ error: 'Invalid operation. Use "encrypt" or "decrypt"' });
      }
    } catch (error) {
      console.error('encryptionService - Encryption service error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);
