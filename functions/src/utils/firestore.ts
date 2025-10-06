import * as admin from 'firebase-admin';

// HTTP encryption service URL
const ENCRYPTION_SERVICE_URL =
  'https://encryptionservice-ae4sy7xjpq-nw.a.run.app';

// Helper functions to call the HTTP encryption service
async function encrypt(text: string): Promise<string> {
  try {
    const response = await fetch(ENCRYPTION_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'encrypt', data: text }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to encrypt data');
    }
    const { result } = await response.json();
    return result;
  } catch (error) {
    console.error('Error calling encryption service (encrypt):', error);
    throw error;
  }
}

async function decrypt(encryptedData: string): Promise<string> {
  try {
    const response = await fetch(ENCRYPTION_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'decrypt', data: encryptedData }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to decrypt data');
    }
    const { result } = await response.json();
    return result;
  } catch (error) {
    console.error('Error calling encryption service (decrypt):', error);
    throw error;
  }
}

interface EncryptedTokens {
  access_token: string;
  refresh_token?: string; // Optional for Monzo pre-verification apps
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
    // Add detailed logging here
    console.log(
      `🔍 DEBUG: Decrypting tokens for provider: ${encryptedTokens.provider}`
    );
    console.log(
      `🔍 DEBUG: Encrypted Access Token (first 30 chars): ${encryptedTokens.access_token.substring(0, 30)}...`
    );
    console.log(
      `🔍 DEBUG: Encrypted Access Token length: ${encryptedTokens.access_token.length}`
    );
    if (encryptedTokens.refresh_token) {
      console.log(
        `🔍 DEBUG: Encrypted Refresh Token (first 30 chars): ${encryptedTokens.refresh_token.substring(0, 30)}...`
      );
      console.log(
        `🔍 DEBUG: Encrypted Refresh Token length: ${encryptedTokens.refresh_token.length}`
      );
    } else {
      console.log(
        `🔍 DEBUG: No refresh token available for ${encryptedTokens.provider}`
      );
    }

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

    const { refresh_token } = await decryptTokens(encryptedTokens);

    // Check if refresh_token exists
    if (!refresh_token) {
      console.warn(
        `⚠️ No refresh_token available for ${provider}. Token cannot be refreshed.`
      );
      console.warn(
        '💡 For Monzo pre-verification apps: User needs to re-authorize.'
      );
      throw new Error('No refresh_token available');
    }

    // Determine token endpoint based on provider
    const tokenEndpoint =
      provider === 'monzo'
        ? 'https://api.monzo.com/oauth2/token'
        : 'https://auth.truelayer.com/connect/token';

    console.log(`🔄 Refreshing ${provider} tokens...`);

    // Exchange refresh token for new access token
    const response = await fetch(tokenEndpoint, {
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
      const errorText = await response.text();
      console.error(`Failed to refresh ${provider} tokens:`, errorText);
      throw new Error(
        `Failed to refresh ${provider} tokens: ${response.status}`
      );
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
        access_token: await encrypt(newTokens.access_token),
        refresh_token: await encrypt(newTokens.refresh_token),
        expires_at: Date.now() + newTokens.expires_in * 1000,
        updated_at: Date.now(),
      });
      console.log(`✅ ${provider} tokens refreshed successfully`);
    }
  } catch (error) {
    console.error(`Error refreshing ${provider} tokens:`, error);
    throw error;
  }
}
