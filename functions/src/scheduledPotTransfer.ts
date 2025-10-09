import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { TrueLayerService } from './services/truelayerService';
import { MonzoService } from './services/monzoService';
import { defineSecret } from 'firebase-functions/params';
// We'll use the HTTP encryption service for consistency with frontend

// Initialize Firebase Admin
admin.initializeApp();

// Environment variables as secrets
const encryptionKey = defineSecret('ENCRYPTION_KEY');
const truelayerClientId = defineSecret('TRUELAYER_CLIENT_ID');
const truelayerClientSecret = defineSecret('TRUELAYER_CLIENT_SECRET');
const monzoClientId = defineSecret('MONZO_CLIENT_ID');
const monzoClientSecret = defineSecret('MONZO_CLIENT_SECRET');

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
    secrets: [
      encryptionKey,
      truelayerClientId,
      truelayerClientSecret,
      monzoClientId,
      monzoClientSecret,
    ],
  },
  async (event) => {
    const timestamp = new Date().toISOString();

    console.log('🚀 Scheduled pot transfer started at:', timestamp);

    // Initialize services
    const truelayerService = new TrueLayerService(
      truelayerClientId.value(),
      truelayerClientSecret.value()
    );

    const monzoService = new MonzoService(truelayerService);
    console.log('📅 Scheduled time:', event.scheduleTime);
    console.log('📝 Job name:', event.jobName);

    try {
      // Initialize services
      // const truelayerService = new TrueLayerService(
      //   encryptionKey.value(),
      //   truelayerClientId.value(),
      //   truelayerClientSecret.value()
      // );
      // const monzoService = new MonzoService(truelayerService);

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
        console.log(`🔍 DEBUG: About to check encryption key...`);
        console.log(
          `🔍 ENCRYPTION KEY CHECK: First 10 chars: ${encryptionKey.value().substring(0, 10)}...`
        );
        console.log(
          `🔍 DEBUG: Encryption key check completed, about to run encryption test...`
        );

        // Debug: Check what tokens this user has
        const userTokenDocs = tokensSnapshot.docs.filter(
          (doc) => doc.data().user_id === userId
        );
        const userTokens = userTokenDocs.map((doc) => ({
          provider: doc.data().provider,
          deleted: doc.data().deleted,
          hasAccessToken: !!doc.data().access_token,
          accessTokenLength: doc.data().access_token?.length || 0,
        }));
        console.log(`🔍 User tokens:`, userTokens);

        // Debug: Check if tokens look valid
        for (const doc of userTokenDocs) {
          const data = doc.data();
          console.log(`🔍 Token for ${data.provider}:`, {
            hasAccessToken: !!data.access_token,
            hasRefreshToken: !!data.refresh_token,
            expiresAt: data.expires_at,
            created: new Date(data.created_at).toISOString(),
          });

          // Debug: Show first few characters of each encrypted token
          if (data.access_token) {
            console.log(
              `🔍 ${data.provider} encrypted access_token (first 50 chars): ${data.access_token.substring(0, 50)}...`
            );
          }
        }

        // Process each user's tokens
        try {
          // Separate credit card providers from bank providers
          const creditCardProviders = userTokens
            .filter(
              (token) =>
                !token.deleted &&
                token.provider !== 'monzo' &&
                token.provider !== 'ob-monzo'
            )
            .map((token) => token.provider);

          // Find both Monzo tokens
          const obMonzoToken = userTokens.find(
            (token) => !token.deleted && token.provider === 'ob-monzo'
          );
          const monzoToken = userTokens.find(
            (token) => !token.deleted && token.provider === 'monzo'
          );

          console.log(`💳 Credit card providers:`, creditCardProviders);
          console.log(`🏦 ob-monzo token:`, obMonzoToken ? 'Found' : 'Missing');
          console.log(`🏦 monzo token:`, monzoToken ? 'Found' : 'Missing');

          // Skip if no credit card providers found
          if (creditCardProviders.length === 0) {
            console.log('  ⚠️ No credit card providers found, skipping user');
            continue;
          }

          // Skip if no ob-monzo token found (needed for reading account data)
          if (!obMonzoToken) {
            console.log('  ⚠️ No ob-monzo token found, skipping user');
            continue;
          }

          // Skip if no monzo token found (needed for writing transfers)
          if (!monzoToken) {
            console.log('  ⚠️ No monzo token found, skipping user');
            continue;
          }

          let totalCreditCardBalance = 0;
          let totalCardsFound = 0;

          // Get cards from each credit card provider
          for (const provider of creditCardProviders) {
            try {
              const cards = await truelayerService.getCards(userId, provider);
              console.log(`  📱 ${provider}: Found ${cards.length} card(s)`);
              totalCardsFound += cards.length;

              // Get balance for each card
              for (const card of cards) {
                const balance = await truelayerService.getCardBalance(
                  userId,
                  card.account_id,
                  provider
                );
                if (balance) {
                  console.log(
                    `    - ${card.display_name}: ${balance.currency} ${balance.current}`
                  );
                  totalCreditCardBalance += balance.current;
                }
              }
            } catch (providerError: any) {
              console.log(
                `  ⚠️ Error getting cards from ${provider}:`,
                providerError.message
              );
            }
          }

          console.log(
            `💰 Total credit card balance: £${totalCreditCardBalance.toFixed(2)} (from ${totalCardsFound} cards)`
          );

          // Get Monzo accounts (main account and credit card pot) using ob-monzo token
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
          const totalMonzoBalance = mainAccountBalance + currentPotBalance;

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
          console.log(
            `  Total Monzo balance: £${totalMonzoBalance.toFixed(2)}`
          );
          console.log(`  Transfer needed: £${transferAmount.toFixed(2)}`);

          // Safety check: Only transfer if total Monzo balance > total credit card debt
          if (totalMonzoBalance <= totalCreditCardBalance) {
            console.log(
              `  ⚠️ SAFETY CHECK FAILED: Total Monzo balance (£${totalMonzoBalance.toFixed(2)}) is not greater than credit card debt (£${totalCreditCardBalance.toFixed(2)})`
            );
            console.log(
              `  💡 Skipping transfer to avoid overdrawing. You need at least £${(totalCreditCardBalance + 1).toFixed(2)} total in Monzo.`
            );
            continue;
          }

          // Check if user has enough money in main account for deposit
          if (transferAmount > 0 && transferAmount > mainAccountBalance) {
            console.log(
              `  ⚠️ Insufficient funds in main account (need £${transferAmount.toFixed(2)}, have £${mainAccountBalance.toFixed(2)})`
            );
            continue;
          }

          // Get Monzo OAuth access token and execute transfer
          const monzoAccessToken = await monzoService.getMonzoAccessToken(
            userId,
            monzoClientId.value(),
            monzoClientSecret.value()
          );

          if (!monzoAccessToken) {
            console.log(
              `  ⚠️ No Monzo OAuth access token found. User needs to click "Enable Automation" in dashboard.`
            );
            console.log(
              `  💡 Would have transferred £${transferAmount.toFixed(2)} ${transferAmount > 0 ? 'to' : 'from'} pot`
            );
            continue;
          }

          // Find the credit card pot using Monzo API to get the correct pot ID
          const creditCardPot =
            await monzoService.findCreditCardPot(monzoAccessToken);

          if (!creditCardPot) {
            console.log(
              `  ⚠️ No credit card pot found via Monzo API. Please ensure you have a pot named "Credit Cards" or containing "💳"`
            );
            console.log(
              `  💡 Would have transferred £${transferAmount.toFixed(2)} ${transferAmount > 0 ? 'to' : 'from'} pot`
            );
            continue;
          }

          // Execute the transfer!
          console.log(`  🚀 Executing transfer...`);
          await monzoService.transferToPot(
            monzoAccessToken,
            monzoAccounts.mainAccount.account_id,
            creditCardPot.id, // Use the correct pot ID from Monzo API
            transferAmount
          );
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
