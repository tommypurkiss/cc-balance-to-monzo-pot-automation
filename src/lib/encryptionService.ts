// /**
//  * Encryption service that calls the Firebase HTTP function
//  * This ensures both frontend and backend use the same encryption logic
//  */

// const ENCRYPTION_SERVICE_URL =
//   'https://encryptionservice-ae4sy7xjpq-nw.a.run.app';

// export async function encrypt(text: string): Promise<string> {
//   try {
//     const response = await fetch(ENCRYPTION_SERVICE_URL, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         operation: 'encrypt',
//         data: text,
//       }),
//     });

//     if (!response.ok) {
//       throw new Error(`Encryption failed: ${response.statusText}`);
//     }

//     const result = await response.json();
//     return result.result;
//   } catch (error) {
//     console.error('Encryption service error:', error);
//     throw error;
//   }
// }

// export async function decrypt(encryptedData: string): Promise<string> {
//   try {
//     const response = await fetch(ENCRYPTION_SERVICE_URL, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         operation: 'decrypt',
//         data: encryptedData,
//       }),
//     });

//     if (!response.ok) {
//       throw new Error(`Decryption failed: ${response.statusText}`);
//     }

//     const result = await response.json();
//     return result.result;
//   } catch (error) {
//     console.error('Decryption service error:', error);
//     throw error;
//   }
// }

/**
 * Encryption service using Firebase Functions SDK
 * This provides better type safety, automatic authentication, and easier error handling
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/lib/firebase'; // Your Firebase app initialization

// Initialise Functions (you can specify region if needed)
const functions = getFunctions(app, 'europe-west2'); // Use your region

// Define types for better type safety
interface EncryptionRequest {
  operation: 'encrypt' | 'decrypt';
  data: string;
}

interface EncryptionResponse {
  result: string;
}

class EncryptionError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Generic function to call the encryption service
 */
async function callEncryptionService(
  operation: 'encrypt' | 'decrypt',
  data: string
): Promise<string> {
  // Input validation
  if (!data || typeof data !== 'string') {
    throw new EncryptionError('Invalid input: data must be a non-empty string');
  }

  try {
    // Create a callable reference to your function
    const encryptionFunction = httpsCallable<
      EncryptionRequest,
      EncryptionResponse
    >(
      functions,
      'encryptionService' // Your function name (without the URL)
    );

    // Call the function - Firebase handles auth, retries, and errors
    const result = await encryptionFunction({
      operation,
      data,
    });

    // Validate response
    if (!result.data.result || typeof result.data.result !== 'string') {
      throw new EncryptionError(
        'Invalid response format from encryption service'
      );
    }

    return result.data.result;
  } catch (error) {
    // Firebase Functions errors have a specific structure
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const firebaseError = error as {
        code: string;
        message: string;
        details?: unknown;
      };

      console.error(`encryptionService - ${operation} failed:`, firebaseError);
      throw new EncryptionError(
        `${operation} failed: ${firebaseError.message}`,
        firebaseError.code,
        error
      );
    }

    // Generic error fallback
    console.error(`encryptionService - ${operation} failed:`, error);
    throw new EncryptionError(
      `Unexpected error during ${operation}`,
      undefined,
      error
    );
  }
}

/**
 * Encrypts plain text
 * @param text - The plain text to encrypt
 * @returns Encrypted string
 * @throws {EncryptionError} If encryption fails
 */
export async function encrypt(text: string): Promise<string> {
  return callEncryptionService('encrypt', text);
}

/**
 * Decrypts encrypted data
 * @param encryptedData - The encrypted string to decrypt
 * @returns Decrypted plain text
 * @throws {EncryptionError} If decryption fails
 */
export async function decrypt(encryptedData: string): Promise<string> {
  return callEncryptionService('decrypt', encryptedData);
}
