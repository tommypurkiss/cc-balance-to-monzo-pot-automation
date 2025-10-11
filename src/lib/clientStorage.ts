// Client-side Storage Service for TrueLayer tokens
// Uses Firestore for persistent storage via API calls
// Avoids importing firebase-admin in client components

export interface TrueLayerSession {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  createdAt: number;
  userId: string;
}

export interface CardData {
  account_id: string;
  card_network: string;
  card_type: string;
  currency: string;
  display_name: string;
  partial_card_number: string;
  name_on_card: string;
  update_timestamp: string;
  provider: {
    display_name: string;
    provider_id: string;
    logo_uri: string;
  };
}

export interface CardBalance {
  currency: string;
  current: number;
  credit_limit: number;
  available?: number;
  last_statement_balance?: number;
  last_statement_date?: string;
  payment_due?: number;
  payment_due_date?: string;
  update_timestamp: string;
}

export interface AccountData {
  account_id: string;
  account_type: string;
  currency: string;
  display_name: string;
  provider: {
    display_name: string;
    provider_id: string;
  };
  update_timestamp: string;
  // Monzo-specific fields
  id?: string;
  description?: string;
  product_type?: string;
  account_number?: string;
  sort_code?: string;
  closed?: boolean;
  country_code?: string;
  legal_entity?: string;
  owner_type?: string;
  owners?: Array<{
    user_id: string;
    preferred_name: string;
    preferred_first_name: string;
  }>;
}

export interface AccountBalance {
  currency: string;
  available: number;
  current: number;
  update_timestamp: string;
  // Monzo-specific balance fields
  balance?: number; // Monzo uses 'balance' instead of 'current'
  spend_today?: number;
  local_currency?: string;
  local_exchange_rate?: number;
  local_spend?: Array<{
    spend_today: number;
    currency: string;
  }>;
}

class ClientStorageService {
  private sessions: TrueLayerSession[] = [];
  private refreshingTokens: Set<string> = new Set();
  private userId: string = '';
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private dataCache: {
    [provider: string]: {
      data: any;
      timestamp: number;
    };
  } = {};
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Initialize with user ID
  setUserId(userId: string) {
    this.userId = userId;
  }

  // Cache management
  private isCacheValid(provider: string): boolean {
    const cached = this.dataCache[provider];
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.CACHE_DURATION;
  }

  private setCache(provider: string, data: any): void {
    this.dataCache[provider] = {
      data,
      timestamp: Date.now(),
    };
  }

  private getCache(provider: string): any | null {
    if (this.isCacheValid(provider)) {
      return this.dataCache[provider].data;
    }
    return null;
  }

  private clearCache(provider?: string): void {
    if (provider) {
      delete this.dataCache[provider];
    } else {
      this.dataCache = {};
    }
  }

  // Public method to force refresh data (clears cache)
  async refreshData(): Promise<{
    [provider: string]: {
      cards: (CardData & { balance?: CardBalance })[];
      accounts: (AccountData & { balance?: AccountBalance })[];
    };
  }> {
    this.clearCache(); // Clear all cached data
    return this.getAllData();
  }

  // Initialize sessions from Firestore only
  async initializeSessions(): Promise<TrueLayerSession[]> {
    if (typeof window === 'undefined') return [];

    this.sessions = [];

    // Load from Firestore if we have a user ID
    if (this.userId) {
      await this.loadFromFirestore();
    }

    return this.sessions;
  }

  // Load sessions from Firestore (for cross-browser persistence)
  private async loadFromFirestore(): Promise<void> {
    try {
      const response = await fetch('/api/truelayer/get-user-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: this.userId }),
      });

      if (response.ok) {
        const tokens = await response.json();

        // Convert Firestore tokens to sessions
        for (const token of tokens) {
          const session: TrueLayerSession = {
            provider: token.provider,
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            expiresAt: token.expires_at,
            createdAt: token.created_at,
            userId: this.userId,
          };

          this.sessions.push(session);
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load tokens from Firestore:', error);
    }
  }

  // Add a new session (store in Firestore only)
  async addSession(session: TrueLayerSession): Promise<void> {
    // Remove existing session for this provider
    this.sessions = this.sessions.filter(
      (s) => s.provider !== session.provider
    );
    this.sessions.push(session);

    // Store in Firestore via API call (if we have a user ID)
    if (this.userId) {
      try {
        await fetch('/api/truelayer/store-tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: session.accessToken,
            refresh_token: session.refreshToken || '',
            expires_in: session.expiresAt
              ? Math.floor((session.expiresAt - Date.now()) / 1000)
              : 3600,
            token_type: 'Bearer',
            scope: 'info accounts balance transactions cards offline_access',
            user_id: this.userId,
            provider: session.provider,
          }),
        });
      } catch (error) {
        console.warn('⚠️ Failed to store tokens in Firestore:', error);
      }
    }
  }

  // Remove a session (clear local state only - tokens remain in Firestore)
  async removeSession(provider: string): Promise<void> {
    this.sessions = this.sessions.filter((s) => s.provider !== provider);
    this.clearCache(provider); // Clear cache for this provider
  }

  // Permanently delete tokens from Firestore (for account disconnection)
  async deleteTokens(provider: string): Promise<void> {
    // Remove from Firestore via API call (if we have a user ID)
    if (this.userId) {
      try {
        await fetch('/api/truelayer/delete-tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: this.userId,
            provider: provider,
          }),
        });
      } catch (error) {
        console.warn('⚠️ Failed to delete tokens from Firestore:', error);
      }
    }

    // Also clear local session
    await this.removeSession(provider);
  }

  // Check if token is expired or will expire soon (within 1 minute)
  isTokenExpired(session: TrueLayerSession): boolean {
    if (!session.expiresAt) return false;
    const now = Date.now();
    const oneMinute = 1 * 60 * 1000; // 1 minute in milliseconds
    return session.expiresAt <= now + oneMinute;
  }

  // Check if session is still valid (within 90 days)
  isSessionValid(session: TrueLayerSession): boolean {
    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
    return now - session.createdAt < ninetyDays;
  }

  // Check if there are any active sessions
  hasSessions(): boolean {
    return this.sessions.length > 0;
  }

  // Get valid token for a provider (with automatic refresh)
  getValidToken(provider: string): string | null {
    const session = this.sessions.find((s) => s.provider === provider);
    if (!session) return null;

    // Check if token needs refresh
    if (this.isTokenExpired(session) && session.refreshToken) {
      // Token is expired, but we can't refresh synchronously
      // Return the token anyway and let the API call handle the refresh
      return session.accessToken;
    }

    return session.accessToken;
  }

  // Refresh token for a session
  async refreshToken(provider: string): Promise<boolean> {
    // Prevent multiple simultaneous refreshes for the same provider
    if (this.refreshingTokens.has(provider)) {
      return false;
    }

    const session = this.sessions.find((s) => s.provider === provider);
    if (!session?.refreshToken) {
      return false;
    }

    // Check if session is still within 90 days
    if (!this.isSessionValid(session)) {
      await this.removeSession(provider);
      return false;
    }

    this.refreshingTokens.add(provider);

    try {
      // Use the correct refresh endpoint based on provider
      const refreshEndpoint =
        provider === 'monzo'
          ? '/api/auth/monzo/refresh'
          : '/api/auth/truelayer/refresh';

      const response = await fetch(refreshEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      });

      const data = await response.json();

      if (data.access_token) {
        // Update session with new tokens
        session.accessToken = data.access_token;
        if (data.refresh_token) {
          session.refreshToken = data.refresh_token;
        }
        if (data.expires_in) {
          session.expiresAt = Date.now() + data.expires_in * 1000;
        }
        await this.addSession(session);
        return true;
      }
    } catch (error) {
      console.error(`❌ Token refresh failed for ${provider}:`, error);
    } finally {
      this.refreshingTokens.delete(provider);
    }

    return false;
  }

  // Generic API call with automatic token refresh
  private async apiCall<T>(
    endpoint: string,
    provider: string,
    retryCount: number = 0
  ): Promise<T> {
    const session = this.sessions.find((s) => s.provider === provider);
    if (!session) throw new Error('No session found for provider');

    // Create a unique key for this request to prevent duplicates
    const requestKey = `${provider}:${endpoint}:${retryCount}`;

    // If this exact request is already pending, return the existing promise
    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey)!;
    }

    // Create the promise for this request
    const requestPromise = this.executeApiCall<T>(
      endpoint,
      provider,
      retryCount
    );

    // Store the promise to prevent duplicate requests
    this.pendingRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up the pending request
      this.pendingRequests.delete(requestKey);
    }
  }

  // Execute the actual API call
  private async executeApiCall<T>(
    endpoint: string,
    provider: string,
    retryCount: number = 0
  ): Promise<T> {
    const session = this.sessions.find((s) => s.provider === provider);
    if (!session) throw new Error('No session found for provider');

    // Check if token needs refresh before making the call
    if (this.isTokenExpired(session)) {
      if (session.refreshToken && !this.refreshingTokens.has(provider)) {
        const refreshed = await this.refreshToken(provider);
        if (!refreshed) {
          throw new Error('Token refresh failed');
        }
      } else {
        // Token is expired but no refresh token available
        throw new Error(
          `Token expired and no refresh token available for ${provider}. Please reconnect your account.`
        );
      }
    }

    // Use the correct API endpoint based on provider
    let response: Response;
    if (provider === 'monzo') {
      // Direct Monzo API call
      const url = `https://api.monzo.com${endpoint}`;
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    } else {
      // TrueLayer proxy for other providers
      response = await fetch(
        `/api/truelayer/proxy?token=${encodeURIComponent(session.accessToken)}&endpoint=${encodeURIComponent(endpoint)}`
      );
    }

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Unknown error' }));

      // Only log errors that aren't expected (like provider not supporting endpoint)
      if (
        response.status !== 501 ||
        error.details?.error !== 'endpoint_not_supported'
      ) {
      }

      // Handle different types of errors
      if (response.status === 401 && retryCount === 0 && session.refreshToken) {
        const refreshed = await this.refreshToken(provider);
        if (refreshed) {
          // Retry the call with the new token
          return this.apiCall<T>(endpoint, provider, retryCount + 1);
        }
      } else if (
        response.status === 501 &&
        error.details?.error === 'endpoint_not_supported'
      ) {
        // This is a TrueLayer API error - the provider doesn't support this endpoint

        throw new Error(`Provider ${provider} does not support this endpoint`);
      }

      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const responseData = await response.json();

    return responseData;
  }

  // Get cards for a provider
  async getCards(provider: string): Promise<CardData[]> {
    try {
      if (provider === 'monzo') {
        // Monzo API doesn't have cards endpoint, return empty array
        // Monzo accounts are handled separately in getAccounts
        return [];
      }

      const data = await this.apiCall<{ results: CardData[] }>(
        '/data/v1/cards',
        provider
      );
      return data.results || [];
    } catch (error) {
      throw error;
    }
  }

  // Get card balance
  async getCardBalance(
    cardId: string,
    provider: string
  ): Promise<CardBalance | null> {
    try {
      if (provider === 'monzo') {
        // Monzo doesn't have cards, return null
        return null;
      }

      const data = await this.apiCall<{ results: CardBalance[] }>(
        `/data/v1/cards/${cardId}/balance`,
        provider
      );
      return data.results?.[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Get accounts for a provider
  async getAccounts(provider: string): Promise<AccountData[]> {
    try {
      if (provider === 'monzo') {
        // Use Monzo's direct API endpoint
        const data = await this.apiCall<{ accounts: AccountData[] }>(
          '/accounts',
          provider
        );
        return data.accounts || [];
      }

      const data = await this.apiCall<{ results: AccountData[] }>(
        '/data/v1/accounts',
        provider
      );
      return data.results || [];
    } catch (error) {
      throw error;
    }
  }

  // Get account balance
  async getAccountBalance(
    accountId: string,
    provider: string
  ): Promise<AccountBalance | null> {
    try {
      if (provider === 'monzo') {
        // Use Monzo's direct API endpoint
        const data = await this.apiCall<AccountBalance>(
          `/balance?account_id=${accountId}`,
          provider
        );
        return data || null;
      }

      const data = await this.apiCall<{ results: AccountBalance[] }>(
        `/data/v1/accounts/${accountId}/balance`,
        provider
      );
      return data.results?.[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Get all data for all connected providers
  async getAllData(): Promise<{
    [provider: string]: {
      cards: (CardData & { balance?: CardBalance })[];
      accounts: (AccountData & { balance?: AccountBalance })[];
    };
  }> {
    const allData: any = {};
    let hasAnyData = false;

    for (const session of this.sessions) {
      // Check cache first
      const cachedData = this.getCache(session.provider);
      if (cachedData) {
        allData[session.provider] = cachedData;
        hasAnyData = true;
        continue;
      }

      try {
        allData[session.provider] = {
          cards: [],
          accounts: [],
        };

        // Get cards and their balances
        try {
          const cards = await this.getCards(session.provider);
          for (const card of cards) {
            try {
              const balance = await this.getCardBalance(
                card.account_id,
                session.provider
              );
              allData[session.provider].cards.push({ ...card, balance });
              hasAnyData = true;
            } catch (error) {
              console.warn(
                `Failed to get balance for card ${card.account_id}:`,
                error
              );
              allData[session.provider].cards.push(card);
              hasAnyData = true;
            }
          }
        } catch (error) {
          console.warn(`Failed to get cards for ${session.provider}:`, error);
          if (
            error instanceof Error &&
            (error.message.includes('invalid_token') ||
              error.message.includes('401'))
          ) {
            throw error;
          }
        }

        // Get accounts and their balances
        try {
          const accounts = await this.getAccounts(session.provider);
          for (const account of accounts) {
            try {
              // Use the correct account ID field for Monzo vs TrueLayer
              const accountId = account.id || account.account_id;
              if (!accountId) {
                console.warn(`No account ID found for account:`, account);
                allData[session.provider].accounts.push(account);
                hasAnyData = true;
                continue;
              }

              const balance = await this.getAccountBalance(
                accountId,
                session.provider
              );
              allData[session.provider].accounts.push({ ...account, balance });
              hasAnyData = true;
            } catch (error) {
              console.warn(
                `Failed to get balance for account ${account.id || account.account_id}:`,
                error
              );
              allData[session.provider].accounts.push(account);
              hasAnyData = true;
            }
          }
        } catch (error) {
          console.warn(
            `Failed to get accounts for ${session.provider}:`,
            error
          );
          if (
            error instanceof Error &&
            (error.message.includes('invalid_token') ||
              error.message.includes('401'))
          ) {
            throw error;
          }
        }

        // Cache the data for this provider
        this.setCache(session.provider, allData[session.provider]);
      } catch (error) {
        console.error(`Failed to get data for ${session.provider}:`, error);
        if (
          error instanceof Error &&
          (error.message.includes('invalid_token') ||
            error.message.includes('401'))
        ) {
          throw error;
        }
      }
    }

    if (this.sessions.length === 0) {
      throw new Error(
        'No valid sessions found. Please reconnect your accounts.'
      );
    }

    if (!hasAnyData) {
      throw new Error('No data available. Your connections may have expired.');
    }

    return allData;
  }
}

// Export singleton instance
export const clientStorage = new ClientStorageService();
