import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { encryptionHelpers } from './encryptionHelpers';
import { info } from 'firebase-functions/logger';

const encryptionKey = defineSecret('ENCRYPTION_KEY');

/**
 * Callable function for encryption/decryption operations
 */
export const encryptionService = onCall(
  {
    secrets: [encryptionKey],
    region: 'europe-west2',
    cors: true, // Automatically handles CORS
  },
  async (request) => {
    info('encryptionService - Request received');

    const { operation, data } = request.data;

    info('encryptionService - Operation:', operation);
    info('encryptionService - Data present:', !!data);

    // Validation
    if (!operation || !data) {
      throw new HttpsError('invalid-argument', 'Missing operation or data');
    }

    if (typeof data !== 'string') {
      throw new HttpsError('invalid-argument', 'Data must be a string');
    }

    if (operation !== 'encrypt' && operation !== 'decrypt') {
      throw new HttpsError(
        'invalid-argument',
        'Invalid operation. Use "encrypt" or "decrypt"'
      );
    }

    const key = encryptionKey.value();

    try {
      let result: string;

      if (operation === 'encrypt') {
        result = encryptionHelpers.encrypt(data, key);
      } else {
        result = encryptionHelpers.decrypt(data, key);
      }

      info('encryptionService - Operation successful');
      return { result };
    } catch (error) {
      console.error('encryptionService - Error:', error);
      throw new HttpsError('internal', 'Encryption service error', error);
    }
  }
);
