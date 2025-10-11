import { TrueLayerService } from './truelayerService';

interface MonzoAccount {
  account_id: string;
  display_name: string;
  account_type: string;
  balance: {
    current: number;
    available: number;
    currency: string;
  } | null;
}

interface MonzoAccounts {
  mainAccount: MonzoAccount | null;
  creditCardPot: MonzoAccount | null;
}

export class MonzoService {
  private truelayerService: TrueLayerService;

  constructor(truelayerService: TrueLayerService) {
    this.truelayerService = truelayerService;
  }

  /**
   * Get Monzo main account and credit card pot using TrueLayer
   */
  async getMonzoAccounts(
    userId: string,
    provider: string = 'ob-monzo'
  ): Promise<MonzoAccounts> {
    const result: MonzoAccounts = {
      mainAccount: null,
      creditCardPot: null,
    };

    try {
      // Get all accounts from TrueLayer
      const accounts = await this.truelayerService.getAccounts(
        userId,
        provider
      );

      console.log(`🏦 Found ${accounts.length} Monzo account(s)`);

      // Find main account (TRANSACTION type)
      const mainAccount = accounts.find(
        (acc) => acc.account_type === 'TRANSACTION'
      );

      if (mainAccount) {
        const balance = await this.truelayerService.getAccountBalance(
          userId,
          mainAccount.account_id,
          provider
        );

        result.mainAccount = {
          account_id: mainAccount.account_id,
          display_name: mainAccount.display_name,
          account_type: mainAccount.account_type,
          balance,
        };

        console.log(
          `  ✅ Main account: ${mainAccount.display_name} - £${balance?.available || 0}`
        );
      }

      // Find credit card pot (SAVINGS type with "Credit Card" in name)
      const creditCardPot = accounts.find(
        (acc) =>
          acc.account_type === 'SAVINGS' &&
          (acc.display_name.toLowerCase().includes('credit card') ||
            acc.display_name.includes('💳'))
      );

      if (creditCardPot) {
        const balance = await this.truelayerService.getAccountBalance(
          userId,
          creditCardPot.account_id,
          provider
        );

        result.creditCardPot = {
          account_id: creditCardPot.account_id,
          display_name: creditCardPot.display_name,
          account_type: creditCardPot.account_type,
          balance,
        };

        console.log(
          `  ✅ Credit card pot: ${creditCardPot.display_name} - £${balance?.current || 0}`
        );
      }

      return result;
    } catch (error) {
      console.error('Error getting Monzo accounts:', error);
      throw error;
    }
  }

  /**
   * Get Monzo pots using Monzo API directly (for pot IDs)
   * This is needed because TrueLayer account IDs != Monzo pot IDs
   */
  async getMonzoPots(monzoAccessToken: string): Promise<any[]> {
    try {
      const response = await fetch('https://api.monzo.com/pots', {
        headers: {
          Authorization: `Bearer ${monzoAccessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch pots: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🔍 Monzo API pots response:', JSON.stringify(data, null, 2));
      return data.pots || [];
    } catch (error) {
      console.error('Error getting Monzo pots:', error);
      throw error;
    }
  }

  /**
   * Find the credit card pot using Monzo API and return the correct pot ID
   */
  async findCreditCardPot(monzoAccessToken: string): Promise<any | null> {
    try {
      const pots = await this.getMonzoPots(monzoAccessToken);

      // Find pot with "Credit Card" in name or 💳 emoji
      const creditCardPot = pots.find(
        (pot) =>
          pot.name.toLowerCase().includes('credit card') ||
          pot.name.includes('💳')
      );

      if (creditCardPot) {
        console.log(
          `  🏦 Found credit card pot: ${creditCardPot.name} (ID: ${creditCardPot.id})`
        );
      }

      return creditCardPot || null;
    } catch (error) {
      console.error('Error finding credit card pot:', error);
      return null;
    }
  }

  /**
   * Get a specific pot by ID using Monzo API
   */
  async getPotById(
    monzoAccessToken: string,
    potId: string
  ): Promise<any | null> {
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
        throw new Error(`Failed to fetch pot: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`  🏦 Found pot: ${data.name} (ID: ${data.id})`);
      return data;
    } catch (error) {
      console.error('Error getting pot by ID:', error);
      return null;
    }
  }

  /**
   * Calculate how much to transfer to the credit card pot
   * Transfer amount = Total credit card balance - Current pot balance
   */
  calculateTransferAmount(
    totalCreditCardBalance: number,
    currentPotBalance: number
  ): number {
    const transferAmount = totalCreditCardBalance - currentPotBalance;

    // Don't transfer if the difference is less than £1 (avoid small transfers)
    if (Math.abs(transferAmount) < 1) {
      console.log('  ℹ️ Transfer amount less than £1, skipping transfer');
      return 0;
    }

    return transferAmount;
  }

  /**
   * Transfer money to/from the credit card pot using Monzo API
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
