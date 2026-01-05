'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useBankingData } from '@/contexts/BankingDataContext';
import { CardData, CardBalance } from '@/lib/clientStorage';

import { useState, useCallback, useEffect } from 'react';
import { AutomationRule } from '../api/automation/rules/route';
import { MonzoPot } from '@/types/monzoPot';
import ExistingAutomationRulesList from '@/components/Automations/ExistingAutomationRulesList';
import CreateAdditionalRule from '@/components/Automations/CreateAutomationRule';

export default function AutomationsPage() {
  const { currentUser } = useAuth();
  const { data } = useBankingData();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Step 1: Credit Card Selection
  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  // Step 2: Pot Selection
  const [pots, setPots] = useState<MonzoPot[]>([]);
  const [selectedPot, setSelectedPot] = useState<string>('');

  // Step 3: Safety Settings
  const [minimumBankBalance, setMinimumBankBalance] = useState(15000); // £150 in pence

  // Step 4: Review
  const [existingRules, setExistingRules] = useState<AutomationRule[]>([]);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Get all credit cards from all providers
  const allCards: (CardData & { balance?: CardBalance; provider: string })[] =
    [];
  Object.keys(data).forEach((provider) => {
    const providerData = data[provider];
    providerData.cards.forEach((card) => {
      allCards.push({ ...card, provider } as CardData & {
        balance?: CardBalance;
        provider: string;
      });
    });
  });

  // Add Monzo Flex accounts as selectable "credit cards" for automation
  const monzoData = data['monzo'];
  if (monzoData) {
    const monzoFlexAccounts = monzoData.accounts.filter(
      (account) => account.type === 'uk_monzo_flex' && !account.closed
    );
    monzoFlexAccounts.forEach((account) => {
      // Convert Monzo Flex account to card-like structure
      const accountId = account.id || account.account_id;
      const displayName = 'Monzo Flex';
      // Extract last 4 digits from description if available, or use account ID
      let partialCardNumber = '';
      if (account.description) {
        // Description format: monzoflex_0000B0mJJxIGYUZniL3AYd
        const match = account.description.match(/(\d{4})/);
        if (match) {
          partialCardNumber = match[1];
        } else {
          // Fallback: use last 4 chars of account ID
          partialCardNumber = accountId.slice(-4);
        }
      } else {
        partialCardNumber = accountId.slice(-4);
      }

      const flexCard = {
        account_id: accountId,
        display_name: displayName,
        partial_card_number: partialCardNumber,
        balance: account.balance
          ? {
              currency: account.balance.currency || account.currency || 'GBP',
              current: account.balance.current || account.balance.balance || 0,
              available:
                account.balance.available || account.balance.balance || 0,
              update_timestamp: account.balance.update_timestamp || '',
            }
          : undefined,
        account_type: 'TRANSACTION',
        currency: account.currency || 'GBP',
        provider: {
          display_name: 'Monzo',
          provider_id: 'monzo',
          logo_uri: '',
        },
        update_timestamp: account.update_timestamp || '',
        card_network: '',
        card_type: '',
        name_on_card: '',
      };

      // Add string provider property for automation (overrides object provider)
      allCards.push({
        ...flexCard,
        provider: 'monzo',
      } as unknown as CardData & {
        balance?: CardBalance;
        provider: string;
      });
    });
  }

  // Deduplicate cards
  const uniqueCards = allCards.filter(
    (card, index, self) =>
      index ===
      self.findIndex(
        (c) =>
          c.account_id === card.account_id &&
          c.partial_card_number === card.partial_card_number
      )
  );

  // Get Monzo main account (for source account in automation)
  const monzoMainAccount = monzoData?.accounts.find(
    (account) =>
      (account.product_type === 'standard' ||
        account.account_type === 'TRANSACTION' ||
        account.type === 'uk_retail') &&
      !account.closed
  );

  const fetchPots = useCallback(async () => {
    if (!currentUser?.uid) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/automation/pots?userId=${currentUser.uid}`
      );
      if (response.ok) {
        const data = (await response.json()) as { pots?: MonzoPot[] };
        setPots(data.pots || []);
      } else {
        const errorData = (await response.json()) as { error?: string };
        const errorMessage = errorData.error || 'Failed to fetch pots';

        // If it's a Monzo connection issue, show a helpful message with action button
        if (errorMessage.includes('Direct Monzo API access required')) {
          setError(errorMessage);
        } else {
          setError(errorMessage);
        }
      }
    } catch {
      setError('Failed to fetch pots');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const checkExistingRules = useCallback(async () => {
    if (!currentUser?.uid) return;

    try {
      const response = await fetch(
        `/api/automation/rules?userId=${currentUser.uid}`
      );
      if (response.ok) {
        const data = (await response.json()) as { rules?: AutomationRule[] };
        setExistingRules(data.rules || []);
      }
    } catch (err) {
      console.error('Error checking existing rules:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.uid && step >= 2) {
      fetchPots();
    }
  }, [currentUser, step, fetchPots]);

  useEffect(() => {
    if (currentUser?.uid) {
      checkExistingRules();
    }
  }, [currentUser, checkExistingRules]);

  const handleCardToggle = (cardId: string) => {
    setSelectedCards((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    );
  };

  const handleSelectAllCards = () => {
    if (selectedCards.length === uniqueCards.length) {
      setSelectedCards([]);
    } else {
      setSelectedCards(uniqueCards.map((card) => card.account_id));
    }
  };

  const handleNext = () => {
    if (step === 1 && selectedCards.length === 0) {
      setError('Please select at least one credit card');
      return;
    }
    if (step === 2 && !selectedPot) {
      setError('Please select a target pot');
      return;
    }
    setError(null);
    setStep(step + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleEditRule = (rule: AutomationRule) => {
    setEditingRuleId(rule.id || null);
    setSelectedCards(rule.creditCards.map((card) => card.accountId));
    setSelectedPot(rule.targetPot.potId);
    setMinimumBankBalance(rule.minimumBankBalance);
    setStep(2);
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
    setSelectedCards([]);
    setSelectedPot('');
    setMinimumBankBalance(15000);
    setStep(1);
  };

  const handleSaveAutomation = async () => {
    if (!currentUser?.uid || !monzoMainAccount) {
      setError('Missing required data');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedCardsData = uniqueCards.filter((card) =>
        selectedCards.includes(card.account_id)
      );

      const automationData = {
        userId: currentUser.uid,
        ruleId: editingRuleId, // Include if editing
        sourceAccount: {
          provider: 'monzo',
          accountId: monzoMainAccount.account_id || monzoMainAccount.id,
        },
        targetPot: {
          potId: selectedPot,
          potName:
            pots.find((pot) => pot.id === selectedPot)?.name || 'Selected Pot',
        },
        creditCards: selectedCardsData.map((card) => ({
          provider: card.provider,
          accountId: card.account_id,
          displayName: card.display_name,
          partialCardNumber: card.partial_card_number,
        })),
        minimumBankBalance,
      };

      const response = await fetch('/api/automation/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(automationData),
      });

      if (response.ok) {
        setSuccess(
          editingRuleId
            ? 'Automation rule updated successfully!'
            : 'Automation rule created successfully!'
        );

        // Refresh the rules list
        await checkExistingRules();

        // Reset form
        setStep(1);
        setSelectedCards([]);
        setSelectedPot('');
        setMinimumBankBalance(15000);
        setEditingRuleId(null);

        setTimeout(() => setSuccess(null), 5000);
      } else {
        const errorData = (await response.json()) as { error?: string };
        setError(errorData.error || 'Failed to save automation rule');
      }
    } catch {
      setError('Failed to save automation rule');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAutomation = async (ruleId: string) => {
    if (!currentUser?.uid) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/automation/rules?userId=${currentUser.uid}&ruleId=${ruleId}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        setSuccess('Automation rule deleted successfully!');
        await checkExistingRules();
        setTimeout(() => setSuccess(null), 5000);
      } else {
        const errorData = (await response.json()) as { error?: string };
        setError(errorData.error || 'Failed to delete automation rule');
      }
    } catch {
      setError('Failed to delete automation rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        {/* Mobile-optimized header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 py-2">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Automations
          </h1>
        </div>
      </div>
      <div className="border border-orange-600 bg-gradient-to-r from-orange-900/20 to-yellow-900/20 p-4 sm:p-6 rounded-lg mt-4">
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-600 rounded text-green-200 text-sm">
            {success}
          </div>
        )}

        {/* Existing Rules Section */}
        {existingRules.length > 0 && (
          <div className="mb-6 space-y-4">
            <h3 className="text-lg font-medium text-green-400 flex items-center">
              <span className="mr-2">✅</span>
              Active Automation Rules ({existingRules.length})
            </h3>

            <ExistingAutomationRulesList
              existingRules={existingRules}
              loading={loading}
              onEditRule={handleEditRule}
              onDeleteRule={handleDeleteAutomation}
            />
          </div>
        )}

        {/* Create/Edit Rule Section */}
        <CreateAdditionalRule
          currentUser={currentUser}
          existingRules={existingRules}
          editingRuleId={editingRuleId}
          selectedCards={selectedCards}
          step={step}
          minimumBankBalance={minimumBankBalance}
          uniqueCards={uniqueCards}
          pots={pots}
          selectedPot={selectedPot}
          loading={loading}
          error={error}
          onCancelEdit={handleCancelEdit}
          onCardToggle={handleCardToggle}
          onSelectAllCards={handleSelectAllCards}
          onNext={handleNext}
          onBack={handleBack}
          onSetSelectedPot={setSelectedPot}
          onSetMinimumBankBalance={setMinimumBankBalance}
          onSaveAutomation={handleSaveAutomation}
        />
      </div>
    </div>
  );
}
