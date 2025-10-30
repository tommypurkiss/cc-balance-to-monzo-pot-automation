import { getEncryptedTokens, decryptTokens, refreshTokens } from './firestore';

/**
 * Perform a TrueLayer API request with automatic token refresh on 401.
 * - Gets the user's current access token
 * - Optionally refreshes if expired by timestamp
 * - Executes the request
 * - On 401, refreshes tokens and retries once
 */
export async function performTrueLayerRequestWithRefresh(params: {
  userId: string;
  provider: string;
  clientId: string;
  clientSecret: string;
  makeRequest: (accessToken: string) => Promise<Response>;
}): Promise<Response> {
  const { userId, provider, clientId, clientSecret, makeRequest } = params;

  // Helper to fetch the latest token (after optional refresh)
  const getCurrentAccessToken = async (): Promise<string> => {
    const encrypted = await getEncryptedTokens(userId, provider);
    if (!encrypted) throw new Error(`No tokens found for user ${userId}`);
    const tokens = await decryptTokens(encrypted);
    return tokens.access_token;
  };

  // If expired by timestamp, proactively refresh first
  try {
    const encrypted = await getEncryptedTokens(userId, provider);
    if (!encrypted) throw new Error(`No tokens found for user ${userId}`);
    const tokens = await decryptTokens(encrypted);
    if (Date.now() >= tokens.expires_at) {
      await refreshTokens(userId, provider, clientId, clientSecret);
    }
  } catch (e) {
    // If any issue determining expiry, fall through and let request/401 logic handle it
  }

  // First attempt
  let accessToken = await getCurrentAccessToken();
  let response = await makeRequest(accessToken);
  if (response.status !== 401) {
    return response;
  }

  // Attempt refresh on 401 and retry once
  await refreshTokens(userId, provider, clientId, clientSecret);
  accessToken = await getCurrentAccessToken();
  response = await makeRequest(accessToken);
  return response;
}
