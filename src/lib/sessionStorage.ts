// Session Storage Service for TrueLayer tokens
// Handles localStorage-based token management with automatic refresh

export interface TrueLayerSession {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  createdAt: number;
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
}

export interface AccountBalance {
  currency: string;
  available: number;
  current: number;
  update_timestamp: string;
}

class SessionStorageService {
  private sessions: TrueLayerSession[] = [];
  private refreshingTokens: Set<string> = new Set();

  // Initialize sessions from localStorage
  initializeSessions(): TrueLayerSession[] {
    if (typeof window === 'undefined') return [];

    this.sessions = [];

    // Load all TrueLayer tokens from localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('truelayer_') && key.endsWith('_token')) {
        const provider = key.replace('truelayer_', '').replace('_token', '');
        const accessToken = localStorage.getItem(key) || '';
        const refreshToken =
          localStorage.getItem(`truelayer_${provider}_refresh_token`) ||
          undefined;
        const expiresAtStr = localStorage.getItem(
          `truelayer_${provider}_expires_at`
        );
        const createdAtStr = localStorage.getItem(
          `truelayer_${provider}_created_at`
        );

        const session: TrueLayerSession = {
          provider,
          accessToken,
          refreshToken,
          expiresAt: expiresAtStr ? parseInt(expiresAtStr) : undefined,
          createdAt: createdAtStr ? parseInt(createdAtStr) : Date.now(),
        };

        // Only add session if it's still valid (within 90 days)
        if (this.isSessionValid(session)) {
          this.sessions.push(session);
        } else {
          // Clean up expired session
          this.removeSession(provider);
        }
      }
    }

    return this.sessions;
  }

  // Get all active sessions
  getSessions(): TrueLayerSession[] {
    return this.sessions;
  }

  // Add a new session
  addSession(session: TrueLayerSession): void {
    if (typeof window === 'undefined') return;

    // Remove existing session for this provider
    this.sessions = this.sessions.filter(
      (s) => s.provider !== session.provider
    );
    // Add new session
    this.sessions.push(session);

    // Save to localStorage
    localStorage.setItem(
      `truelayer_${session.provider}_token`,
      session.accessToken
    );
    if (session.refreshToken) {
      localStorage.setItem(
        `truelayer_${session.provider}_refresh_token`,
        session.refreshToken
      );
    }
    if (session.expiresAt) {
      localStorage.setItem(
        `truelayer_${session.provider}_expires_at`,
        session.expiresAt.toString()
      );
    }
    localStorage.setItem(
      `truelayer_${session.provider}_created_at`,
      session.createdAt.toString()
    );
  }

  // Remove a session
  removeSession(provider: string): void {
    if (typeof window === 'undefined') return;

    this.sessions = this.sessions.filter((s) => s.provider !== provider);
    localStorage.removeItem(`truelayer_${provider}_token`);
    localStorage.removeItem(`truelayer_${provider}_refresh_token`);
    localStorage.removeItem(`truelayer_${provider}_expires_at`);
    localStorage.removeItem(`truelayer_${provider}_created_at`);
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
    if (!session?.refreshToken) return false;

    // Check if session is still within 90 days
    if (!this.isSessionValid(session)) {
      this.removeSession(provider);
      return false;
    }

    this.refreshingTokens.add(provider);

    try {
      const response = await fetch('/api/auth/truelayer/refresh', {
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
        this.addSession(session);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
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

    // Check if token needs refresh before making the call
    if (
      this.isTokenExpired(session) &&
      session.refreshToken &&
      !this.refreshingTokens.has(provider)
    ) {
      const refreshed = await this.refreshToken(provider);
      if (!refreshed) {
        throw new Error('Token refresh failed');
      }
    }

    const response = await fetch(
      `/api/truelayer/proxy?token=${encodeURIComponent(session.accessToken)}&endpoint=${encodeURIComponent(endpoint)}`
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Unknown error' }));

      // If it's an auth error and we haven't retried yet, try refreshing the token
      if (
        (error.error?.includes('invalid_token') || response.status === 401) &&
        retryCount === 0 &&
        session.refreshToken
      ) {
        const refreshed = await this.refreshToken(provider);
        if (refreshed) {
          // Retry the call with the new token
          return this.apiCall<T>(endpoint, provider, retryCount + 1);
        }
      }

      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Get cards for a provider
  async getCards(provider: string): Promise<CardData[]> {
    try {
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
          // If it's an auth error, throw it up to be handled by the dashboard
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
              const balance = await this.getAccountBalance(
                account.account_id,
                session.provider
              );
              allData[session.provider].accounts.push({ ...account, balance });
              hasAnyData = true;
            } catch (error) {
              console.warn(
                `Failed to get balance for account ${account.account_id}:`,
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
          // If it's an auth error, throw it up to be handled by the dashboard
          if (
            error instanceof Error &&
            (error.message.includes('invalid_token') ||
              error.message.includes('401'))
          ) {
            throw error;
          }
        }
      } catch (error) {
        console.error(`Failed to get data for ${session.provider}:`, error);
        // If it's an auth error, throw it up to be handled by the dashboard
        if (
          error instanceof Error &&
          (error.message.includes('invalid_token') ||
            error.message.includes('401'))
        ) {
          throw error;
        }
      }
    }

    // If we have no valid sessions or no data, throw an error
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
export const sessionStorage = new SessionStorageService();
