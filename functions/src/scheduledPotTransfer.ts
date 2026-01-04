import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { TrueLayerService } from './services/truelayerService';
import { MonzoService } from './services/monzoService';
import { defineSecret } from 'firebase-functions/params';
import { info } from 'firebase-functions/logger';

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

    info(
      `scheduledPotTransfer - Scheduled pot transfer started at: ${timestamp}`
    );

    // Initialize services
    const truelayerService = new TrueLayerService(
      truelayerClientId.value(),
      truelayerClientSecret.value()
    );

    const monzoService = new MonzoService();
    info(`scheduledPotTransfer - Scheduled time: ${event.scheduleTime}`);
    info(`scheduledPotTransfer - Job name: ${event.jobName}`);

    try {
      const db = admin.firestore();

      // Get all users who have automation rules
      const automationRulesSnapshot = await db
        .collection('automation_rules')
        .get();

      if (automationRulesSnapshot.empty) {
        info('scheduledPotTransfer - No users with automation rules found');
        return;
      }

      info(
        `scheduledPotTransfer - Processing ${automationRulesSnapshot.size} user(s) with automation rules`
      );

      // Process each user's automation rules
      for (const doc of automationRulesSnapshot.docs) {
        const userId = doc.id;
        const userData = doc.data();
        const rules: AutomationRule[] = userData.rules || [];

        info(
          `\nscheduledPotTransfer - Processing user: ${userId} (${rules.length} rule(s))`
        );

        // Find active automation rules
        const activeRules = rules.filter((rule) => rule.isActive);

        if (activeRules.length === 0) {
          info(
            'scheduledPotTransfer - No active automation rules found, skipping user'
          );
          continue;
        }

        info(
          `scheduledPotTransfer - Found ${activeRules.length} active rule(s) for user`
        );

        // Check if user has required tokens (only once per user)
        const tokensSnapshot = await db
          .collection('user_tokens')
          .where('user_id', '==', userId)
          .where('deleted', '==', false)
          .get();

        if (tokensSnapshot.empty) {
          info('scheduledPotTransfer - No tokens found for user, skipping');
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
          info(
            'scheduledPotTransfer - No direct Monzo token found (needed for all operations), skipping user'
          );
          continue;
        }

        // Get Monzo OAuth access token once for all rules
        const monzoAccessToken = await monzoService.getMonzoAccessToken(
          userId,
          monzoClientId.value(),
          monzoClientSecret.value()
        );

        if (!monzoAccessToken) {
          info(
            `scheduledPotTransfer - No Monzo OAuth access token found. User needs to connect Monzo with write access. Skipping user.`
          );
          continue;
        }

        // Process each active rule
        for (const rule of activeRules) {
          info(`\n--- Processing rule: ${rule.id} ---`);
          info(
            `scheduledPotTransfer - Target pot: ${rule.targetPot.potName} (${rule.targetPot.potId})`
          );
          info(
            `scheduledPotTransfer - Credit cards: ${rule.creditCards.length} selected`
          );
          rule.creditCards.forEach((card, index) => {
            info(
              `  ${index + 1}. ${card.displayName} (Provider: ${card.provider}, Account ID: ${card.accountId}, Last 4: ****${card.partialCardNumber})`
            );
          });
          info(
            `scheduledPotTransfer - Minimum bank balance: £${(rule.minimumBankBalance / 100).toFixed(2)}`
          );

          try {
            // Get credit card balances for selected cards
            let totalCreditCardBalance = 0;
            let totalCardsFound = 0;

            info(
              `scheduledPotTransfer - Processing ${rule.creditCards.length} credit cards...`
            );

            for (const card of rule.creditCards) {
              info(
                `scheduledPotTransfer - Processing card: ${card.displayName} (Provider: ${card.provider}, Account ID: ${card.accountId})`
              );

              try {
                info(
                  `scheduledPotTransfer - Attempting to get balance for ${card.displayName}...`
                );

                let balance: any = null;

                // Handle Monzo Flex accounts (provider === 'monzo')
                if (card.provider === 'monzo') {
                  // Get balance using Monzo API (returns number in pounds)
                  const monzoBalance = await monzoService.getAccountBalance(
                    monzoAccessToken,
                    card.accountId
                  );

                  if (monzoBalance !== null) {
                    // Monzo Flex balance is negative (debt owed)
                    // Convert to positive to match TrueLayer format (positive = debt)
                    const debtAmount = Math.abs(monzoBalance);

                    // Convert to AccountBalance-like structure
                    balance = {
                      currency: 'GBP',
                      current: debtAmount, // Positive value representing debt (in pounds)
                      available: debtAmount,
                      update_timestamp: new Date().toISOString(),
                    };

                    info(
                      `scheduledPotTransfer - Monzo Flex raw balance: £${monzoBalance.toFixed(2)} (negative), converted to debt: £${debtAmount.toFixed(2)}`
                    );
                  }
                } else {
                  // Handle TrueLayer credit cards
                  balance = await truelayerService.getCardBalance(
                    userId,
                    card.accountId,
                    card.provider
                  );
                }

                info(
                  `scheduledPotTransfer - Balance response for ${card.displayName}:`,
                  balance
                );

                if (balance) {
                  info(
                    `scheduledPotTransfer - ${card.displayName} (****${card.partialCardNumber}): ${balance.currency} ${balance.current}`
                  );
                  totalCreditCardBalance += balance.current;
                  totalCardsFound++;
                } else {
                  info(
                    `scheduledPotTransfer - No balance data returned for ${card.displayName}`
                  );
                }
              } catch (cardError: any) {
                info(
                  `scheduledPotTransfer - Error getting balance for ${card.displayName}:`,
                  cardError.message
                );
                info(`scheduledPotTransfer - Full error details:`, cardError);
              }
            }

            info(
              `scheduledPotTransfer - Total credit card balance: £${totalCreditCardBalance.toFixed(2)} (from ${totalCardsFound} cards)`
            );

            // Get main account balance using the account ID from the automation rule
            const mainAccountBalance = await monzoService.getAccountBalance(
              monzoAccessToken,
              rule.sourceAccount.accountId
            );

            if (mainAccountBalance === null) {
              info(
                `scheduledPotTransfer - Could not fetch main account balance for rule ${rule.id}, skipping rule`
              );
              continue;
            }

            info(
              `scheduledPotTransfer - Main account balance: £${mainAccountBalance.toFixed(2)}`
            );

            // Get the target pot balance using the pot ID from the automation rule
            const currentPotBalance = await monzoService.getPotBalance(
              monzoAccessToken,
              rule.targetPot.potId
            );

            if (currentPotBalance === null) {
              info(
                `scheduledPotTransfer - Could not fetch target pot "${rule.targetPot.potName}" balance, skipping rule`
              );
              continue;
            }

            info(
              `scheduledPotTransfer - Current pot balance: £${(currentPotBalance / 100).toFixed(2)}`
            );

            // Calculate transfer amount (full credit card balance)
            const transferAmount = totalCreditCardBalance * 100; // Convert to pence
            const transferAmountPounds = transferAmount / 100;

            if (transferAmount === 0 || totalCreditCardBalance === 0) {
              info(
                `scheduledPotTransfer - No credit card debt found for rule ${rule.id}, no transfer needed`
              );
              continue;
            }

            // Check minimum bank balance threshold
            if (mainAccountBalance <= rule.minimumBankBalance / 100) {
              info(
                `scheduledPotTransfer - MINIMUM BALANCE CHECK FAILED: Main account balance (£${mainAccountBalance.toFixed(2)}) is at or below minimum threshold (£${(rule.minimumBankBalance / 100).toFixed(2)})`
              );
              info(
                `scheduledPotTransfer - Skipping transfer for rule ${rule.id} to maintain minimum balance`
              );
              continue;
            }

            // Safety check: Ensure we have enough in main account
            if (transferAmount > mainAccountBalance * 100) {
              info(
                `scheduledPotTransfer - INSUFFICIENT FUNDS: Need £${transferAmountPounds.toFixed(2)} but only have £${mainAccountBalance.toFixed(2)} in main account`
              );
              info(
                `scheduledPotTransfer - Skipping transfer for rule ${rule.id}`
              );
              continue;
            }

            info(
              `\nscheduledPotTransfer - Transfer summary for rule ${rule.id}:`
            );
            info(
              `scheduledPotTransfer - Credit card debt: £${totalCreditCardBalance.toFixed(2)}`
            );
            info(
              `scheduledPotTransfer - Current pot balance: £${(currentPotBalance / 100).toFixed(2)}`
            );
            info(
              `scheduledPotTransfer - Main account balance: £${mainAccountBalance.toFixed(2)}`
            );
            info(
              `scheduledPotTransfer - Transfer amount: £${transferAmountPounds.toFixed(2)}`
            );
            info(
              `scheduledPotTransfer - Target pot: ${rule.targetPot.potName}`
            );

            // Execute the transfer!
            info(
              `scheduledPotTransfer - Executing transfer for rule ${rule.id}...`
            );
            await monzoService.transferToPot(
              monzoAccessToken,
              rule.sourceAccount.accountId,
              rule.targetPot.potId,
              transferAmount
            );

            info(
              `scheduledPotTransfer - Transfer completed successfully for rule ${rule.id}!`
            );
          } catch (ruleError: any) {
            console.error(
              `scheduledPotTransfer - Error processing rule ${rule.id}:`,
              ruleError
            );
            // Continue with next rule
          }
        }

        info(
          `scheduledPotTransfer - Completed processing all rules for user ${userId}`
        );
      }

      info(
        '\nscheduledPotTransfer - Scheduled pot transfer completed successfully'
      );
    } catch (error) {
      console.error(
        'scheduledPotTransfer - Error in scheduled pot transfer:',
        error
      );
      throw error;
    }
  }
);
