import {
  getEncryptedTokens,
  decryptTokens,
  refreshTokens,
} from '../utils/firestore';
import { performTrueLayerRequestWithRefresh } from '../utils/tokenHelpers';

interface CardBalance {
  current: number;
  available: number;
  credit_limit: number;
  currency: string;
}

interface AccountBalance {
  current: number;
  available: number;
  currency: string;
}

export class TrueLayerService {
  private clientId: string;
  private clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Get valid access token for a user, refreshing if needed
   */
  private async getValidAccessToken(
    userId: string,
    provider: string = 'truelayer'
  ): Promise<string> {
    console.log(
      `🔍 getValidAccessToken called for userId: ${userId}, provider: ${provider}`
    );

    const encryptedTokens = await getEncryptedTokens(userId, provider);
    if (!encryptedTokens) {
      console.error(
        `❌ No encrypted tokens found for user ${userId}, provider: ${provider}`
      );
      throw new Error(`No tokens found for user ${userId}`);
    }
    console.log(`✅ Encrypted tokens found for ${provider}`);

    const tokens = await decryptTokens(encryptedTokens);
    console.log(
      `🔓 Tokens decrypted for ${provider}, expires_at: ${new Date(tokens.expires_at).toISOString()}`
    );

    // Check if token is expired
    const now = Date.now();
    const isExpired = now >= tokens.expires_at;
    console.log(
      `⏰ Token expiry check: now=${now}, expires_at=${tokens.expires_at}, isExpired=${isExpired}`
    );

    if (isExpired) {
      console.log(
        `🔄 Token expired for user ${userId}, provider: ${provider}, refreshing...`
      );
      try {
        await refreshTokens(userId, provider, this.clientId, this.clientSecret);
        console.log(`✅ Token refresh successful for ${provider}`);

        // Get the refreshed tokens
        const refreshedEncryptedTokens = await getEncryptedTokens(
          userId,
          provider
        );
        if (!refreshedEncryptedTokens) {
          console.error(
            `❌ Failed to get refreshed encrypted tokens for ${provider}`
          );
          throw new Error('Failed to get refreshed tokens');
        }
        const refreshedTokens = await decryptTokens(refreshedEncryptedTokens);
        console.log(`✅ Using refreshed access token for ${provider}`);
        return refreshedTokens.access_token;
      } catch (refreshError) {
        console.error(`❌ Token refresh failed for ${provider}:`, refreshError);
        throw refreshError;
      }
    }

    console.log(`✅ Using existing valid access token for ${provider}`);
    return tokens.access_token;
  }

  /**
   * Get all credit cards for a user
   */
  async getCards(
    userId: string,
    provider: string = 'truelayer'
  ): Promise<any[]> {
    const accessToken = await this.getValidAccessToken(userId, provider);

    const response = await fetch('https://api.truelayer.com/data/v1/cards', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch cards: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  }

  /**
   * Get balance for a specific card
   */
  async getCardBalance(
    userId: string,
    accountId: string,
    provider: string = 'truelayer'
  ): Promise<CardBalance | null> {
    console.log(
      `🔍 TrueLayerService.getCardBalance called for userId: ${userId}, accountId: ${accountId}, provider: ${provider}`
    );

    try {
      console.log(`🔑 Getting valid access token for provider: ${provider}`);
      const accessToken = await this.getValidAccessToken(userId, provider);
      console.log(
        `✅ Access token obtained for ${provider} (length: ${accessToken.length})`
      );

      const apiUrl = `https://api.truelayer.com/data/v1/cards/${accountId}/balance`;
      console.log(`🌐 Making API call to: ${apiUrl}`);

      const response = await performTrueLayerRequestWithRefresh({
        userId,
        provider,
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        makeRequest: async (token: string) =>
          fetch(apiUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }),
      });

      console.log(
        `📡 API response status: ${response.status} ${response.statusText}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `❌ Failed to fetch balance for card ${accountId}: ${response.status} ${response.statusText}`
        );
        console.error(`❌ Error response body: ${errorText}`);
        return null;
      }

      const data = await response.json();
      console.log(`📊 Raw API response data:`, JSON.stringify(data, null, 2));

      const result = data.results?.[0] || null;
      console.log(`📋 Processed balance result:`, result);

      return result;
    } catch (error) {
      console.error(`💥 Exception in getCardBalance for ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Get all bank accounts for a user
   */
  async getAccounts(
    userId: string,
    provider: string = 'truelayer'
  ): Promise<any[]> {
    const accessToken = await this.getValidAccessToken(userId, provider);

    const response = await fetch('https://api.truelayer.com/data/v1/accounts', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch accounts: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  }

  /**
   * Get balance for a specific account
   */
  async getAccountBalance(
    userId: string,
    accountId: string,
    provider: string = 'truelayer'
  ): Promise<AccountBalance | null> {
    const accessToken = await this.getValidAccessToken(userId, provider);

    const response = await fetch(
      `https://api.truelayer.com/data/v1/accounts/${accountId}/balance`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch balance for account ${accountId}`);
      return null;
    }

    const data = await response.json();
    return data.results?.[0] || null;
  }
}
