/**
 * Encryption service that calls the Firebase HTTP function
 * This ensures both frontend and backend use the same encryption logic
 */

const ENCRYPTION_SERVICE_URL =
  'https://europe-west2-cc-to-monzo-pot-automation.cloudfunctions.net/encryptionService';

export async function encrypt(text: string): Promise<string> {
  try {
    const response = await fetch(ENCRYPTION_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'encrypt',
        data: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Encryption failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.result;
  } catch (error) {
    console.error('Encryption service error:', error);
    throw error;
  }
}

export async function decrypt(encryptedData: string): Promise<string> {
  try {
    const response = await fetch(ENCRYPTION_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'decrypt',
        data: encryptedData,
      }),
    });

    if (!response.ok) {
      throw new Error(`Decryption failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.result;
  } catch (error) {
    console.error('Decryption service error:', error);
    throw error;
  }
}
