import * as admin from 'firebase-admin';
import { encrypt, decrypt } from './encryption';

interface EncryptedTokens {
  access_token: string;
  refresh_token: string;
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
export async function decryptTokens(
  encryptedTokens: EncryptedTokens,
  encryptionKey: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
}> {
  try {
    return {
      access_token: decrypt(encryptedTokens.access_token, encryptionKey),
      refresh_token: decrypt(encryptedTokens.refresh_token, encryptionKey),
      expires_at: encryptedTokens.expires_at,
      scope: encryptedTokens.scope,
    };
  } catch (error) {
    console.error('Error decrypting tokens:', error);
    throw error;
  }
}

/**
 * Refresh TrueLayer tokens
 */
export async function refreshTokens(
  userId: string,
  provider: string,
  encryptionKey: string,
  clientId: string,
  clientSecret: string
): Promise<void> {
  try {
    const encryptedTokens = await getEncryptedTokens(userId, provider);
    if (!encryptedTokens) {
      throw new Error('No tokens found for user');
    }

    const { refresh_token } = await decryptTokens(
      encryptedTokens,
      encryptionKey
    );

    // Exchange refresh token for new access token
    const response = await fetch('https://auth.truelayer.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh_token,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh tokens');
    }

    const newTokens: TrueLayerTokenResponse = await response.json();

    // Update tokens in Firestore
    const db = admin.firestore();
    const snapshot = await db
      .collection('user_tokens')
      .where('user_id', '==', userId)
      .where('provider', '==', provider)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({
        access_token: encrypt(newTokens.access_token, encryptionKey),
        refresh_token: encrypt(newTokens.refresh_token, encryptionKey),
        expires_at: Date.now() + newTokens.expires_in * 1000,
        updated_at: Date.now(),
      });
    }
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    throw error;
  }
}
