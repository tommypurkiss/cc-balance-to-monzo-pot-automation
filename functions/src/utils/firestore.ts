// import * as admin from 'firebase-admin';
// import { info } from 'firebase-functions/logger';

// // HTTP encryption service URL
// const ENCRYPTION_SERVICE_URL =
//   'https://encryptionservice-ae4sy7xjpq-nw.a.run.app';

// // Helper functions to call the HTTP encryption service
// async function encrypt(text: string): Promise<string> {
//   try {
//     const response = await fetch(ENCRYPTION_SERVICE_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ operation: 'encrypt', data: text }),
//     });
//     if (!response.ok) {
//       const errorData = await response.json();
//       throw new Error(errorData.error || 'Failed to encrypt data');
//     }
//     const { result } = await response.json();
//     return result;
//   } catch (error) {
//     console.error('Error calling encryption service (encrypt):', error);
//     throw error;
//   }
// }

// async function decrypt(encryptedData: string): Promise<string> {
//   try {
//     const response = await fetch(ENCRYPTION_SERVICE_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ operation: 'decrypt', data: encryptedData }),
//     });
//     if (!response.ok) {
//       const errorData = await response.json();
//       throw new Error(errorData.error || 'Failed to decrypt data');
//     }
//     const { result } = await response.json();
//     return result;
//   } catch (error) {
//     console.error('Error calling encryption service (decrypt):', error);
//     throw error;
//   }
// }

// interface EncryptedTokens {
//   access_token: string;
//   refresh_token?: string; // Optional for Monzo pre-verification apps
//   expires_at: number;
//   scope: string;
//   provider: string;
//   user_id: string;
//   created_at: number;
//   updated_at: number;
//   deleted: boolean;
// }

// interface TrueLayerTokenResponse {
//   access_token: string;
//   refresh_token: string;
//   expires_in: number;
//   token_type: string;
//   scope: string;
// }

// /**
//  * Get encrypted tokens for a user from Firestore
//  */
// export async function getEncryptedTokens(
//   userId: string,
//   provider: string = 'truelayer'
// ): Promise<EncryptedTokens | null> {
//   try {
//     const db = admin.firestore();
//     const snapshot = await db
//       .collection('user_tokens')
//       .where('user_id', '==', userId)
//       .where('provider', '==', provider)
//       .where('deleted', '==', false)
//       .limit(1)
//       .get();

//     if (snapshot.empty) {
//       return null;
//     }

//     return snapshot.docs[0].data() as EncryptedTokens;
//   } catch (error) {
//     console.error('Error retrieving encrypted tokens:', error);
//     throw error;
//   }
// }

// /**
//  * Decrypt tokens
//  */
// export async function decryptTokens(encryptedTokens: EncryptedTokens): Promise<{
//   access_token: string;
//   refresh_token?: string;
//   expires_at: number;
//   scope: string;
// }> {
//   try {
//     return {
//       access_token: await decrypt(encryptedTokens.access_token),
//       refresh_token: encryptedTokens.refresh_token
//         ? await decrypt(encryptedTokens.refresh_token)
//         : undefined,
//       expires_at: encryptedTokens.expires_at,
//       scope: encryptedTokens.scope,
//     };
//   } catch (error) {
//     console.error('Error decrypting tokens:', error);
//     throw error;
//   }
// }

// /**
//  * Refresh tokens (supports both TrueLayer and Monzo)
//  */
// export async function refreshTokens(
//   userId: string,
//   provider: string,
//   clientId: string,
//   clientSecret: string
// ): Promise<void> {
//   try {
//     const encryptedTokens = await getEncryptedTokens(userId, provider);
//     if (!encryptedTokens) {
//       throw new Error('No tokens found for user');
//     }

//     const { refresh_token, scope } = await decryptTokens(encryptedTokens);

//     // Check if refresh_token exists
//     if (!refresh_token) {
//       console.warn(
//         `firestore - No refresh_token available for ${provider}. Token cannot be refreshed.`
//       );
//       console.warn(
//         'firestore - For Monzo pre-verification apps: User needs to re-authorize.'
//       );
//       throw new Error('firestore - No refresh_token available');
//     }

//     // Determine token endpoint based on provider
//     const tokenEndpoint =
//       provider === 'monzo'
//         ? 'https://api.monzo.com/oauth2/token'
//         : 'https://auth.truelayer.com/connect/token';

//     // Sanitize client credentials (secrets often include accidental newlines)
//     const cleanedClientId = (clientId || '').replace(/\r?\n/g, '').trim();
//     const cleanedClientSecret = (clientSecret || '')
//       .replace(/\r?\n/g, '')
//       .trim();

//     info(`firestore - Refreshing ${provider} tokens...`);

//     // Exchange refresh token for new access token
//     const refreshParams: any = {
//       grant_type: 'refresh_token',
//       client_id: cleanedClientId,
//       client_secret: cleanedClientSecret,
//       refresh_token: refresh_token,
//     };

//     // Add scope for TrueLayer (required for refresh token requests)
//     if (provider !== 'monzo' && scope) {
//       refreshParams.scope = scope;
//     }

//     const response = await fetch(tokenEndpoint, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/x-www-form-urlencoded',
//       },
//       body: new URLSearchParams(refreshParams),
//     });

//     if (!response.ok) {
//       const errorText = await response.text();
//       console.error(
//         `firestore - Failed to refresh ${provider} tokens:`,
//         errorText
//       );
//       console.error(
//         `firestore - Response status: ${response.status} ${response.statusText}`
//       );
//       console.error(`firestore - Request params:`, {
//         grant_type: refreshParams.grant_type,
//         client_id: refreshParams.client_id,
//         scope: refreshParams.scope,
//         refresh_token_length: refreshParams.refresh_token?.length || 0,
//       });
//       throw new Error(
//         `firestore - Failed to refresh ${provider} tokens: ${response.status} - ${errorText}`
//       );
//     }

//     const newTokens: TrueLayerTokenResponse = await response.json();

//     // Update tokens in Firestore
//     const db = admin.firestore();
//     const snapshot = await db
//       .collection('user_tokens')
//       .where('user_id', '==', userId)
//       .where('provider', '==', provider)
//       .limit(1)
//       .get();

//     if (!snapshot.empty) {
//       await snapshot.docs[0].ref.update({
//         access_token: await encrypt(newTokens.access_token),
//         refresh_token: await encrypt(newTokens.refresh_token),
//         expires_at: Date.now() + newTokens.expires_in * 1000,
//         updated_at: Date.now(),
//       });
//       info(`firestore - ${provider} tokens refreshed successfully`);
//     }
//   } catch (error) {
//     console.error(`firestore - Error refreshing ${provider} tokens:`, error);
//     throw error;
//   }
// }

import * as admin from 'firebase-admin';
import { info } from 'firebase-functions/logger';
import { defineSecret } from 'firebase-functions/params';
import { encryptionHelpers } from '../http/encryption/encryptionHelpers';

const encryptionKey = defineSecret('ENCRYPTION_KEY');

// Helper functions using the shared encryption logic
async function encrypt(text: string): Promise<string> {
  try {
    return encryptionHelpers.encrypt(text, encryptionKey.value());
  } catch (error) {
    console.error('Error encrypting data:', error);
    throw error;
  }
}

async function decrypt(encryptedData: string): Promise<string> {
  try {
    return encryptionHelpers.decrypt(encryptedData, encryptionKey.value());
  } catch (error) {
    console.error('Error decrypting data:', error);
    throw error;
  }
}

interface EncryptedTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope: string;
  provider: string;
  user_id: string;
  created_at: number;
  updated_at: number;
  deleted: boolean;
}

interface TrueLayerTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Get encrypted tokens for a user from Firestore
 */
export async function getEncryptedTokens(
  userId: string,
  provider: string = 'truelayer'
): Promise<EncryptedTokens | null> {
  try {
    const db = admin.firestore();
    const snapshot = await db
      .collection('user_tokens')
      .where('user_id', '==', userId)
      .where('provider', '==', provider)
      .where('deleted', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as EncryptedTokens;
  } catch (error) {
    console.error('Error retrieving encrypted tokens:', error);
    throw error;
  }
}

/**
 * Decrypt tokens
 */
export async function decryptTokens(encryptedTokens: EncryptedTokens): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope: string;
}> {
  try {
    return {
      access_token: await decrypt(encryptedTokens.access_token),
      refresh_token: encryptedTokens.refresh_token
        ? await decrypt(encryptedTokens.refresh_token)
        : undefined,
      expires_at: encryptedTokens.expires_at,
      scope: encryptedTokens.scope,
    };
  } catch (error) {
    console.error('Error decrypting tokens:', error);
    throw error;
  }
}

/**
 * Refresh tokens (supports both TrueLayer and Monzo)
 */
export async function refreshTokens(
  userId: string,
  provider: string,
  clientId: string,
  clientSecret: string
): Promise<void> {
  try {
    const encryptedTokens = await getEncryptedTokens(userId, provider);
    if (!encryptedTokens) {
      throw new Error('No tokens found for user');
    }

    const { refresh_token, scope } = await decryptTokens(encryptedTokens);

    if (!refresh_token) {
      console.warn(
        `firestore - No refresh_token available for ${provider}. Token cannot be refreshed.`
      );
      console.warn(
        'firestore - For Monzo pre-verification apps: User needs to re-authorize.'
      );
      throw new Error('firestore - No refresh_token available');
    }

    const tokenEndpoint =
      provider === 'monzo'
        ? 'https://api.monzo.com/oauth2/token'
        : 'https://auth.truelayer.com/connect/token';

    const cleanedClientId = (clientId || '').replace(/\r?\n/g, '').trim();
    const cleanedClientSecret = (clientSecret || '')
      .replace(/\r?\n/g, '')
      .trim();

    info(`firestore - Refreshing ${provider} tokens...`);

    const refreshParams: any = {
      grant_type: 'refresh_token',
      client_id: cleanedClientId,
      client_secret: cleanedClientSecret,
      refresh_token: refresh_token,
    };

    if (provider !== 'monzo' && scope) {
      refreshParams.scope = scope;
    }

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(refreshParams),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `firestore - Failed to refresh ${provider} tokens:`,
        errorText
      );
      console.error(
        `firestore - Response status: ${response.status} ${response.statusText}`
      );
      console.error(`firestore - Request params:`, {
        grant_type: refreshParams.grant_type,
        client_id: refreshParams.client_id,
        scope: refreshParams.scope,
        refresh_token_length: refreshParams.refresh_token?.length || 0,
      });
      throw new Error(
        `firestore - Failed to refresh ${provider} tokens: ${response.status} - ${errorText}`
      );
    }

    const newTokens: TrueLayerTokenResponse = await response.json();

    const db = admin.firestore();
    const snapshot = await db
      .collection('user_tokens')
      .where('user_id', '==', userId)
      .where('provider', '==', provider)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({
        access_token: await encrypt(newTokens.access_token),
        refresh_token: await encrypt(newTokens.refresh_token),
        expires_at: Date.now() + newTokens.expires_in * 1000,
        updated_at: Date.now(),
      });
      info(`firestore - ${provider} tokens refreshed successfully`);
    }
  } catch (error) {
    console.error(`firestore - Error refreshing ${provider} tokens:`, error);
    throw error;
  }
}
