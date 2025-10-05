import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { TrueLayerService } from './services/truelayerService';
import { MonzoService } from './services/monzoService';
import { defineString } from 'firebase-functions/params';

// Initialize Firebase Admin
admin.initializeApp();

// Environment variables
const encryptionKey = defineString('ENCRYPTION_KEY');
const truelayerClientId = defineString('TRUELAYER_CLIENT_ID');
const truelayerClientSecret = defineString('TRUELAYER_CLIENT_SECRET');

/**
 * Scheduled function that runs every night at 2:00 AM (UK time)
 *
 * This function will:
 * 1. Check total credit card balances for users
 * 2. Check Monzo account balance
 * 3. Automatically transfer funds to a designated Monzo pot
 *
 * Cron expression: '0 2 * * *' means:
 * - minute: 0 (at the start of the hour)
 * - hour: 2 (2 AM)
 * - day of month: * (every day)
 * - month: * (every month)
 * - day of week: * (every day of the week)
 */
export const scheduledPotTransfer = onSchedule(
  {
    schedule: '0 2 * * *', // Every day at 2:00 AM
    timeZone: 'Europe/London', // UK timezone
    region: 'europe-west2', // London region
  },
  async (event) => {
    const timestamp = new Date().toISOString();

    console.log('🚀 Scheduled pot transfer started at:', timestamp);
    console.log('📅 Scheduled time:', event.scheduleTime);
    console.log('📝 Job name:', event.jobName);

    try {
      // Initialize services
      const truelayerService = new TrueLayerService(
        encryptionKey.value(),
        truelayerClientId.value(),
        truelayerClientSecret.value()
      );
      const monzoService = new MonzoService(truelayerService);

      // Get all users who have TrueLayer tokens (for now, we'll process all users)
      const db = admin.firestore();
      const tokensSnapshot = await db
        .collection('user_tokens')
        .where('deleted', '==', false)
        .get();

      if (tokensSnapshot.empty) {
        console.log('ℹ️ No users with tokens found');
        return;
      }

      // Get unique user IDs
      const userIds = new Set<string>();
      tokensSnapshot.forEach((doc) => {
        const data = doc.data();
        userIds.add(data.user_id);
      });

      console.log(`📊 Processing ${userIds.size} user(s)`);

      // Process each user
      for (const userId of userIds) {
        console.log(`\n👤 Processing user: ${userId}`);

        try {
          // Get credit cards
          const cards = await truelayerService.getCards(userId);
          console.log(`💳 Found ${cards.length} credit card(s)`);

          let totalCreditCardBalance = 0;

          // Get balance for each card
          for (const card of cards) {
            const balance = await truelayerService.getCardBalance(
              userId,
              card.account_id
            );
            if (balance) {
              console.log(
                `  - ${card.display_name}: ${balance.currency} ${balance.current}`
              );
              totalCreditCardBalance += balance.current;
            }
          }

          console.log(
            `💰 Total credit card balance: £${totalCreditCardBalance.toFixed(2)}`
          );

          // Get Monzo accounts (main account and credit card pot)
          const monzoAccounts = await monzoService.getMonzoAccounts(
            userId,
            'ob-monzo'
          );

          if (!monzoAccounts.mainAccount) {
            console.log('  ⚠️ No Monzo main account found, skipping user');
            continue;
          }

          if (!monzoAccounts.creditCardPot) {
            console.log('  ⚠️ No credit card pot found, skipping user');
            continue;
          }

          // Calculate transfer amount
          const currentPotBalance =
            monzoAccounts.creditCardPot.balance?.current || 0;
          const transferAmount = monzoService.calculateTransferAmount(
            totalCreditCardBalance,
            currentPotBalance
          );

          if (transferAmount === 0) {
            console.log('  ℹ️ No transfer needed, balances are aligned');
            continue;
          }

          const mainAccountBalance =
            monzoAccounts.mainAccount.balance?.available || 0;

          console.log(`\n💡 Transfer summary:`);
          console.log(
            `  Credit card debt: £${totalCreditCardBalance.toFixed(2)}`
          );
          console.log(
            `  Current pot balance: £${currentPotBalance.toFixed(2)}`
          );
          console.log(
            `  Main account balance: £${mainAccountBalance.toFixed(2)}`
          );
          console.log(`  Transfer needed: £${transferAmount.toFixed(2)}`);

          // Check if user has enough money in main account for deposit
          if (transferAmount > 0 && transferAmount > mainAccountBalance) {
            console.log(
              `  ⚠️ Insufficient funds in main account (need £${transferAmount.toFixed(2)}, have £${mainAccountBalance.toFixed(2)})`
            );
            continue;
          }

          // TODO: Get Monzo OAuth token and execute transfer
          // For now, just log what would happen
          console.log(
            `  ✅ Would transfer £${transferAmount.toFixed(2)} ${transferAmount > 0 ? 'to' : 'from'} pot`
          );

          /*
          // Uncomment when Monzo OAuth is implemented:
          const monzoToken = await monzoService.getMonzoAccessToken(userId);
          if (monzoToken) {
            await monzoService.transferToPot(
              monzoToken,
              monzoAccounts.mainAccount.account_id,
              monzoAccounts.creditCardPot.account_id,
              transferAmount
            );
          }
          */
        } catch (userError) {
          console.error(`❌ Error processing user ${userId}:`, userError);
          // Continue with next user
        }
      }

      console.log('\n✅ Scheduled pot transfer completed successfully');
    } catch (error) {
      console.error('❌ Error in scheduled pot transfer:', error);
      throw error;
    }
  }
);
