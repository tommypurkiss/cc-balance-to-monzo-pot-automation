import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { TrueLayerTokenResponse, EncryptedTokens } from '@/types/truelayer';
import { encrypt, decrypt } from './encryption';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

export async function storeEncryptedTokens(
  tokens: TrueLayerTokenResponse,
  userId: string
): Promise<void> {
  try {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }

    const encryptedTokens: EncryptedTokens = {
      access_token: encrypt(tokens.access_token, encryptionKey),
      refresh_token: encrypt(tokens.refresh_token, encryptionKey),
      expires_at: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
      provider: 'truelayer',
      user_id: userId,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    await db.collection('user_tokens').doc(userId).set(encryptedTokens);
    console.log('Tokens stored successfully for user:', userId);
  } catch (error) {
    console.error('Error storing encrypted tokens:', error);
    throw error;
  }
}

export async function getEncryptedTokens(
  userId: string
): Promise<EncryptedTokens | null> {
  try {
    const doc = await db.collection('user_tokens').doc(userId).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as EncryptedTokens;
  } catch (error) {
    console.error('Error retrieving encrypted tokens:', error);
    throw error;
  }
}

export async function decryptTokens(encryptedTokens: EncryptedTokens): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
}> {
  try {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }

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

export async function refreshTokens(userId: string): Promise<EncryptedTokens> {
  try {
    const encryptedTokens = await getEncryptedTokens(userId);
    if (!encryptedTokens) {
      throw new Error('No tokens found for user');
    }

    const { refresh_token } = await decryptTokens(encryptedTokens);

    // Exchange refresh token for new access token
    const response = await fetch(
      'https://auth.truelayer.com/connect/oauth2/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: process.env.TRUELAYER_CLIENT_ID!,
          client_secret: process.env.TRUELAYER_CLIENT_SECRET!,
          refresh_token: refresh_token,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to refresh tokens');
    }

    const newTokens: TrueLayerTokenResponse = await response.json();

    // Store the new tokens
    await storeEncryptedTokens(newTokens, userId);

    return {
      ...encryptedTokens,
      access_token: encrypt(
        newTokens.access_token,
        process.env.ENCRYPTION_KEY!
      ),
      refresh_token: encrypt(
        newTokens.refresh_token,
        process.env.ENCRYPTION_KEY!
      ),
      expires_at: Date.now() + newTokens.expires_in * 1000,
      updated_at: Date.now(),
    };
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    throw error;
  }
}
