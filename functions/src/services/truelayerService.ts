import {
  getEncryptedTokens,
  decryptTokens,
  refreshTokens,
} from '../utils/firestore';

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
    const encryptedTokens = await getEncryptedTokens(userId, provider);
    if (!encryptedTokens) {
      throw new Error(`No tokens found for user ${userId}`);
    }

    const tokens = await decryptTokens(encryptedTokens);

    // Check if token is expired
    if (Date.now() >= tokens.expires_at) {
      console.log(`Token expired for user ${userId}, refreshing...`);
      await refreshTokens(userId, provider, this.clientId, this.clientSecret);

      // Get the refreshed tokens
      const refreshedEncryptedTokens = await getEncryptedTokens(
        userId,
        provider
      );
      if (!refreshedEncryptedTokens) {
        throw new Error('Failed to get refreshed tokens');
      }
      const refreshedTokens = await decryptTokens(refreshedEncryptedTokens);
      return refreshedTokens.access_token;
    }

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
    const accessToken = await this.getValidAccessToken(userId, provider);

    const response = await fetch(
      `https://api.truelayer.com/data/v1/cards/${accountId}/balance`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch balance for card ${accountId}`);
      return null;
    }

    const data = await response.json();
    return data.results?.[0] || null;
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
