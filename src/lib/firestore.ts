import { getAdminDb } from './firebase-admin';
import { TrueLayerTokenResponse, EncryptedTokens } from '@/types/truelayer';
import { encrypt, decrypt } from './encryption';

export async function storeEncryptedTokens(
  tokens: TrueLayerTokenResponse,
  userId: string,
  provider: string = 'truelayer'
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
      provider: provider,
      user_id: userId,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted: false,
    };

    // Check if tokens already exist for this user/provider combination
    const adminDb = getAdminDb();
    const existingSnapshot = await adminDb
      .collection('user_tokens')
      .where('user_id', '==', userId)
      .where('provider', '==', provider)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      // Update existing document
      const docId = existingSnapshot.docs[0].id;
      await adminDb
        .collection('user_tokens')
        .doc(docId)
        .update({
          ...encryptedTokens,
          created_at: existingSnapshot.docs[0].data().created_at, // Preserve original creation time
          updated_at: Date.now(),
          deleted: false, // Ensure it's not marked as deleted
          deleted_at: null, // Clear deletion timestamp
        });
      console.log(
        'Tokens updated successfully for user:',
        userId,
        'provider:',
        provider
      );
    } else {
      // Create new document with random ID
      await adminDb.collection('user_tokens').add(encryptedTokens);
      console.log(
        'Tokens stored successfully for user:',
        userId,
        'provider:',
        provider
      );
    }
  } catch (error) {
    console.error('Error storing encrypted tokens:', error);
    throw error;
  }
}

export async function getEncryptedTokens(
  userId: string,
  provider: string = 'truelayer'
): Promise<EncryptedTokens | null> {
  try {
    const adminDb = getAdminDb();
    const snapshot = await adminDb
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

export async function getAllEncryptedTokensForUser(
  userId: string
): Promise<EncryptedTokens[]> {
  try {
    const adminDb = getAdminDb();
    const snapshot = await adminDb
      .collection('user_tokens')
      .where('user_id', '==', userId)
      .where('deleted', '==', false)
      .get();

    const tokens: EncryptedTokens[] = [];
    snapshot.forEach((doc) => {
      tokens.push(doc.data() as EncryptedTokens);
    });

    return tokens;
  } catch (error) {
    console.error('Error retrieving all encrypted tokens for user:', error);
    throw error;
  }
}

export async function restoreDeletedTokens(
  userId: string,
  provider: string
): Promise<void> {
  try {
    const adminDb = getAdminDb();
    const snapshot = await adminDb
      .collection('user_tokens')
      .where('user_id', '==', userId)
      .where('provider', '==', provider)
      .where('deleted', '==', true)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({
        deleted: false,
        deleted_at: null,
        updated_at: Date.now(),
      });
      console.log(
        '✅ Tokens restored for user:',
        userId,
        'provider:',
        provider
      );
    }
  } catch (error) {
    console.error('Error restoring deleted tokens:', error);
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
