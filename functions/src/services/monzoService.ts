export class MonzoService {
  /**
   * Get account balance using Monzo API
   */
  async getAccountBalance(
    monzoAccessToken: string,
    accountId: string
  ): Promise<number | null> {
    try {
      const response = await fetch(
        `https://api.monzo.com/balance?account_id=${accountId}`,
        {
          headers: {
            Authorization: `Bearer ${monzoAccessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(
          `Failed to fetch account balance: ${response.statusText}`
        );
        return null;
      }

      const data = await response.json();
      return data.balance / 100; // Convert from pence to pounds
    } catch (error) {
      console.error('Error getting account balance:', error);
      return null;
    }
  }

  /**
   * Get pot balance using Monzo API
   */
  async getPotBalance(
    monzoAccessToken: string,
    potId: string
  ): Promise<number | null> {
    try {
      const response = await fetch(`https://api.monzo.com/pots/${potId}`, {
        headers: {
          Authorization: `Bearer ${monzoAccessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`  ⚠️ Pot with ID ${potId} not found`);
          return null;
        }
        console.error(`Failed to fetch pot: ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      return data.balance; // Pot balance is already in pence
    } catch (error) {
      console.error('Error getting pot balance:', error);
      return null;
    }
  }

  /**
   * Transfer money to/from a pot using Monzo API
   *
   * Positive amount = deposit into pot (from main account)
   * Negative amount = withdraw from pot (to main account)
   *
   * Note: This requires Monzo OAuth access token (separate from TrueLayer)
   * TrueLayer is read-only, we need Monzo API for write operations
   */
  async transferToPot(
    monzoAccessToken: string,
    mainAccountId: string,
    potId: string,
    amount: number
  ): Promise<boolean> {
    try {
      // Determine if we're depositing to or withdrawing from the pot
      const isDeposit = amount > 0;
      const amountInPence = Math.abs(Math.round(amount * 100));

      if (amountInPence === 0) {
        console.log('  ℹ️ Transfer amount is £0, skipping');
        return false;
      }

      const action = isDeposit ? 'deposit' : 'withdraw';
      console.log(
        `💸 ${isDeposit ? 'Depositing' : 'Withdrawing'} £${Math.abs(amount).toFixed(2)} ${isDeposit ? 'into' : 'from'} pot...`
      );

      // Build the endpoint and parameters based on action
      const endpoint = `https://api.monzo.com/pots/${potId}/${action}`;

      const params: Record<string, string> = {
        amount: amountInPence.toString(),
        dedupe_id: `pot-${action}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };

      if (isDeposit) {
        // Deposit: money comes FROM the main account INTO the pot
        params.source_account_id = mainAccountId;
      } else {
        // Withdraw: money goes FROM the pot INTO the main account
        params.destination_account_id = mainAccountId;
      }

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${monzoAccessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Monzo API error:', errorData);
        throw new Error(`Failed to ${action}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`  ✅ ${isDeposit ? 'Deposit' : 'Withdrawal'} successful!`);
      console.log(`  📊 New pot balance: £${(data.balance / 100).toFixed(2)}`);

      return true;
    } catch (error) {
      console.error('Error transferring to/from pot:', error);
      throw error;
    }
  }

  /**
   * Get Monzo OAuth access token from Firestore
   * This is SEPARATE from TrueLayer - used for write access (pot transfers)
   */
  async getMonzoAccessToken(
    userId: string,
    clientId: string,
    clientSecret: string
  ): Promise<string | null> {
    try {
      const { getEncryptedTokens, decryptTokens, refreshTokens } = await import(
        '../utils/firestore'
      );

      // Get Monzo OAuth tokens (separate from TrueLayer)
      const encryptedTokens = await getEncryptedTokens(userId, 'monzo');

      if (!encryptedTokens) {
        console.log(
          '⚠️ No Monzo OAuth tokens found for user. User needs to enable automation.'
        );
        return null;
      }

      const tokens = await decryptTokens(encryptedTokens);

      // Check if token is expired
      if (Date.now() >= tokens.expires_at) {
        console.log('🔄 Monzo token expired, refreshing...');
        await refreshTokens(userId, 'monzo', clientId, clientSecret);

        // Get refreshed tokens
        const refreshedEncryptedTokens = await getEncryptedTokens(
          userId,
          'monzo'
        );
        if (!refreshedEncryptedTokens) {
          console.error('❌ Failed to get refreshed Monzo tokens');
          return null;
        }

        const refreshedTokens = await decryptTokens(refreshedEncryptedTokens);
        return refreshedTokens.access_token;
      }

      return tokens.access_token;
    } catch (error) {
      console.error('Error getting Monzo access token:', error);
      return null;
    }
  }
}
