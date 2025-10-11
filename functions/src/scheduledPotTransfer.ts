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

interface AutomationRule {
  id: string;
  userId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  sourceAccount: {
    provider: string;
    accountId: string;
  };
  targetPot: {
    potId: string;
    potName: string;
  };
  creditCards: Array<{
    provider: string;
    accountId: string;
    displayName: string;
    partialCardNumber: string;
  }>;
  minimumBankBalance: number;
  transferType: 'full_balance';
}

/**
 * Scheduled function that runs every night at 2:00 AM (UK time)
 *
 * This function will:
 * 1. Check for active automation rules for each user
 * 2. Get credit card balances for selected cards
 * 3. Check Monzo account balance against minimum threshold
 * 4. Automatically transfer funds to the user-selected pot
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

    const monzoService = new MonzoService();
    console.log('📅 Scheduled time:', event.scheduleTime);
    console.log('📝 Job name:', event.jobName);

    try {
      const db = admin.firestore();

      // Get all users who have automation rules
      const automationRulesSnapshot = await db
        .collection('automation_rules')
        .get();

      if (automationRulesSnapshot.empty) {
        console.log('ℹ️ No users with automation rules found');
        return;
      }

      console.log(
        `📊 Processing ${automationRulesSnapshot.size} user(s) with automation rules`
      );

      // Process each user's automation rules
      for (const doc of automationRulesSnapshot.docs) {
        const userId = doc.id;
        const userData = doc.data();
        const rules: AutomationRule[] = userData.rules || [];

        console.log(
          `\n👤 Processing user: ${userId} (${rules.length} rule(s))`
        );

        // Find active automation rules
        const activeRules = rules.filter((rule) => rule.isActive);

        if (activeRules.length === 0) {
          console.log('  ⚠️ No active automation rules found, skipping user');
          continue;
        }

        // Process the first active rule (for now, we only support one rule per user)
        const rule = activeRules[0];
        console.log(`  📋 Processing rule: ${rule.id}`);
        console.log(
          `  🎯 Target pot: ${rule.targetPot.potName} (${rule.targetPot.potId})`
        );
        console.log(`  💳 Credit cards: ${rule.creditCards.length} selected`);
        console.log(
          `  💰 Minimum bank balance: £${(rule.minimumBankBalance / 100).toFixed(2)}`
        );

        try {
          // Check if user has required tokens
          const tokensSnapshot = await db
            .collection('user_tokens')
            .where('user_id', '==', userId)
            .where('deleted', '==', false)
            .get();

          if (tokensSnapshot.empty) {
            console.log('  ⚠️ No tokens found for user, skipping');
            continue;
          }

          const userTokens = tokensSnapshot.docs.map((doc) => ({
            provider: doc.data().provider,
            deleted: doc.data().deleted,
            hasAccessToken: !!doc.data().access_token,
          }));

          // Check for required tokens
          const hasMonzoToken = userTokens.some(
            (token) => !token.deleted && token.provider === 'monzo'
          );

          if (!hasMonzoToken) {
            console.log(
              '  ⚠️ No direct Monzo token found (needed for all operations), skipping'
            );
            continue;
          }

          // Get credit card balances for selected cards
          let totalCreditCardBalance = 0;
          let totalCardsFound = 0;

          for (const card of rule.creditCards) {
            try {
              const balance = await truelayerService.getCardBalance(
                userId,
                card.accountId,
                card.provider
              );
              if (balance) {
                console.log(
                  `    - ${card.displayName} (****${card.partialCardNumber}): ${balance.currency} ${balance.current}`
                );
                totalCreditCardBalance += balance.current;
                totalCardsFound++;
              }
            } catch (cardError: any) {
              console.log(
                `    ⚠️ Error getting balance for ${card.displayName}:`,
                cardError.message
              );
            }
          }

          console.log(
            `  💳 Total credit card balance: £${totalCreditCardBalance.toFixed(2)} (from ${totalCardsFound} cards)`
          );

          // Get Monzo OAuth access token for all operations
          const monzoAccessToken = await monzoService.getMonzoAccessToken(
            userId,
            monzoClientId.value(),
            monzoClientSecret.value()
          );

          if (!monzoAccessToken) {
            console.log(
              `  ⚠️ No Monzo OAuth access token found. User needs to connect Monzo with write access.`
            );
            continue;
          }

          // Get main account balance using the account ID from the automation rule
          const mainAccountBalance = await monzoService.getAccountBalance(
            monzoAccessToken,
            rule.sourceAccount.accountId
          );

          if (mainAccountBalance === null) {
            console.log(
              '  ⚠️ Could not fetch main account balance, skipping user'
            );
            continue;
          }

          console.log(
            `  💰 Main account balance: £${mainAccountBalance.toFixed(2)}`
          );

          // Get the target pot balance using the pot ID from the automation rule
          const currentPotBalance = await monzoService.getPotBalance(
            monzoAccessToken,
            rule.targetPot.potId
          );

          if (currentPotBalance === null) {
            console.log(
              `  ⚠️ Could not fetch target pot "${rule.targetPot.potName}" balance, skipping`
            );
            continue;
          }

          console.log(
            `  🏦 Current pot balance: £${(currentPotBalance / 100).toFixed(2)}`
          );

          // Calculate transfer amount (full credit card balance)
          const transferAmount = totalCreditCardBalance * 100; // Convert to pence
          const transferAmountPounds = transferAmount / 100;

          if (transferAmount === 0) {
            console.log('  ℹ️ No credit card debt found, no transfer needed');
            continue;
          }

          // Check minimum bank balance threshold
          if (mainAccountBalance <= rule.minimumBankBalance / 100) {
            console.log(
              `  ⚠️ MINIMUM BALANCE CHECK FAILED: Main account balance (£${mainAccountBalance.toFixed(2)}) is at or below minimum threshold (£${(rule.minimumBankBalance / 100).toFixed(2)})`
            );
            console.log('  💡 Skipping transfer to maintain minimum balance');
            continue;
          }

          // Safety check: Ensure we have enough in main account
          if (transferAmount > mainAccountBalance * 100) {
            console.log(
              `  ⚠️ INSUFFICIENT FUNDS: Need £${transferAmountPounds.toFixed(2)} but only have £${mainAccountBalance.toFixed(2)} in main account`
            );
            continue;
          }

          console.log(`\n  💡 Transfer summary:`);
          console.log(
            `    Credit card debt: £${totalCreditCardBalance.toFixed(2)}`
          );
          console.log(
            `    Current pot balance: £${(currentPotBalance / 100).toFixed(2)}`
          );
          console.log(
            `    Main account balance: £${mainAccountBalance.toFixed(2)}`
          );
          console.log(
            `    Transfer amount: £${transferAmountPounds.toFixed(2)}`
          );
          console.log(`    Target pot: ${rule.targetPot.potName}`);

          // Execute the transfer!
          console.log(`  🚀 Executing transfer...`);
          await monzoService.transferToPot(
            monzoAccessToken,
            rule.sourceAccount.accountId,
            rule.targetPot.potId,
            transferAmount
          );

          console.log(`  ✅ Transfer completed successfully!`);
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
