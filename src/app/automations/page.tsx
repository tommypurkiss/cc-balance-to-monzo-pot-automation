'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useBankingData } from '@/contexts/BankingDataContext';
import { CardData, CardBalance } from '@/lib/clientStorage';
import { formatCurrency } from '@/shared-utils/formatCurrency';
import { getProviderDisplayName } from '@/shared-utils/getProviderNames';
import { useState, useCallback, useEffect } from 'react';
import { AutomationRule } from '../api/automation/rules/route';
import { MonzoPot } from '@/types/monzoPot';

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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Automations
          </h1>
        </div>
      </div>
      <div className="border border-orange-600 bg-gradient-to-r from-orange-900/20 to-yellow-900/20 p-4 sm:p-6 rounded-lg">
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

            {existingRules.map((rule) => (
              <div
                key={rule.id}
                className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg"
              >
                <div className="bg-gray-800/50 border border-green-500/30 p-4 rounded-lg mb-4">
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-400 text-sm">Target Pot</p>
                      <p className="font-semibold text-white text-lg">
                        {rule.targetPot.potName}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Credit Cards</p>
                      <p className="font-semibold text-white">
                        {rule.creditCards.length} selected
                      </p>
                      <div className="text-xs text-gray-300 mt-2 space-y-1">
                        {rule.creditCards.map((card) => (
                          <div
                            key={card.accountId}
                            className="bg-gray-700/50 p-2 rounded"
                          >
                            {card.displayName} (****{card.partialCardNumber})
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">
                        Minimum Bank Balance
                      </span>
                      <span className="font-semibold text-white">
                        {formatCurrency(rule.minimumBankBalance, 'GBP', true)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Status</span>
                      <span
                        className={`font-semibold ${rule.isActive ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleEditRule(rule)}
                    className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium w-full sm:w-auto"
                  >
                    Edit Rule
                  </button>
                  <button
                    onClick={() => handleDeleteAutomation(rule.id || '')}
                    disabled={loading}
                    className="bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 w-full sm:w-auto"
                  >
                    {loading ? 'Deleting...' : 'Delete Rule'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Rule Section */}
        <div className="bg-gray-800/50 border border-orange-500/30 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-white flex items-center">
              <span className="mr-2">{editingRuleId ? '✏️' : '➕'}</span>
              {editingRuleId
                ? 'Edit Automation Rule'
                : existingRules.length > 0
                  ? 'Create Additional Rule'
                  : 'Set Up New Automation Rule'}
            </h3>
            {editingRuleId && (
              <button
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-white text-sm"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {/* Step 1: Credit Card Selection */}
          {step === 1 && (
            <div>
              <h3 className="text-lg font-medium text-white mb-4">
                Select Credit Cards to Monitor
              </h3>
              <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                Choose which credit cards should be included in the automation.
                The system will transfer funds based on the total balance of
                selected cards.
              </p>

              <div className="mb-4">
                <button
                  onClick={handleSelectAllCards}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 w-full sm:w-auto"
                >
                  {selectedCards.length === uniqueCards.length
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {uniqueCards.map((card) => (
                  <label
                    key={card.account_id}
                    className="flex items-start p-4 bg-gray-700/50 rounded-lg border border-gray-600 hover:bg-gray-600 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCards.includes(card.account_id)}
                      onChange={() => handleCardToggle(card.account_id)}
                      className="mr-4 mt-1 w-4 h-4"
                    />
                    <div className="flex-grow">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                        <span className="font-medium text-white text-lg">
                          {card.display_name}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-600 px-2 py-1 rounded w-fit">
                          {getProviderDisplayName(card.provider)}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <span className="text-gray-400 text-sm">
                          ****{card.partial_card_number}
                        </span>
                        {card.balance && (
                          <span className="font-semibold text-white text-lg">
                            {formatCurrency(
                              card.balance.current,
                              card.balance.currency,
                              card.provider === 'monzo'
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={handleNext}
                  disabled={selectedCards.length === 0}
                  className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  Next: Choose Pot
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Pot Selection */}
          {step === 2 && (
            <div>
              <h3 className="text-lg font-medium text-white mb-4">
                Choose Target Pot
              </h3>
              <p className="text-gray-300 text-sm mb-4">
                Select which Monzo pot should receive the transferred funds.
              </p>

              {loading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400 mx-auto"></div>
                  <p className="text-gray-300 mt-2">Loading pots...</p>
                </div>
              ) : error &&
                error.includes('Direct Monzo API access required') ? (
                <div className="text-center py-4">
                  <div className="mb-4">
                    <div className="mx-auto w-12 h-12 bg-orange-600/20 rounded-full flex items-center justify-center mb-3">
                      <svg
                        className="w-6 h-6 text-orange-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium text-white mb-2">
                      Monzo Write Access Required
                    </h4>
                    <p className="text-gray-300 text-sm mb-4">
                      To set up automation, you need to connect your Monzo
                      account with write access. This allows the system to
                      transfer funds to your pots.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const userId = currentUser?.uid || 'anonymous';
                      window.location.href = `/api/auth/monzo?userId=${userId}`;
                    }}
                    className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 font-medium"
                  >
                    Connect Monzo with Write Access
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {pots.map((pot) => (
                    <label
                      key={pot.id}
                      className="flex items-start p-4 bg-gray-700/50 rounded-lg border border-gray-600 hover:bg-gray-600 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="pot"
                        value={pot.id}
                        checked={selectedPot === pot.id}
                        onChange={(e) => setSelectedPot(e.target.value)}
                        className="mr-4 mt-1 w-4 h-4"
                      />
                      <div className="flex-grow">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                          <span className="font-medium text-white text-lg">
                            {pot.name}
                          </span>
                          <span className="text-xs text-gray-500 bg-gray-600 px-2 py-1 rounded w-fit">
                            {pot.type}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold text-white text-lg">
                            {formatCurrency(pot.balance, pot.currency, true)}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6">
                <button
                  onClick={editingRuleId ? handleCancelEdit : handleBack}
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium w-full sm:w-auto"
                >
                  {editingRuleId ? 'Cancel' : 'Back'}
                </button>
                <button
                  onClick={handleNext}
                  disabled={!selectedPot}
                  className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  Next: Safety Settings
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Safety Settings */}
          {step === 3 && (
            <div>
              <h3 className="text-lg font-medium text-white mb-4">
                Safety Settings
              </h3>
              <p className="text-gray-300 text-sm mb-4">
                Set a minimum balance threshold to prevent transfers when your
                main account balance is too low.
              </p>

              <div className="bg-gray-700 p-4 rounded border border-gray-600">
                <label className="block text-sm font-medium text-white mb-2">
                  Minimum Bank Balance
                </label>
                <div className="flex items-center">
                  <span className="text-gray-400 mr-2">£</span>
                  <input
                    type="number"
                    value={minimumBankBalance / 100}
                    onChange={(e) =>
                      setMinimumBankBalance(
                        Math.max(0, parseFloat(e.target.value) * 100)
                      )
                    }
                    min="0"
                    step="0.01"
                    className="bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 w-32"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Transfers will be skipped if your main account balance is at
                  or below this amount.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6">
                <button
                  onClick={handleBack}
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium w-full sm:w-auto"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 font-medium w-full sm:w-auto"
                >
                  Next: Review
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div>
              <h3 className="text-lg font-medium text-white mb-4">
                Review Automation Rule
              </h3>
              <p className="text-gray-300 text-sm mb-4">
                Please review your automation settings before saving.
              </p>

              <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 space-y-4">
                <div>
                  <p className="text-gray-400 text-sm">Credit Cards Selected</p>
                  <p className="font-semibold text-white text-lg">
                    {selectedCards.length} card
                    {selectedCards.length !== 1 ? 's' : ''}
                  </p>
                  <div className="text-xs text-gray-300 mt-2 space-y-1">
                    {uniqueCards
                      .filter((card) => selectedCards.includes(card.account_id))
                      .map((card) => (
                        <div
                          key={card.account_id}
                          className="bg-gray-600/50 p-2 rounded"
                        >
                          {card.display_name} (****{card.partial_card_number})
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Target Pot</span>
                  <span className="font-semibold text-white">
                    {pots.find((pot) => pot.id === selectedPot)?.name}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">
                    Minimum Bank Balance
                  </span>
                  <span className="font-semibold text-white">
                    {formatCurrency(minimumBankBalance, 'GBP', true)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Transfer Type</span>
                  <span className="font-semibold text-white">
                    Full Credit Card Balance
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6">
                <button
                  onClick={handleBack}
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium w-full sm:w-auto"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveAutomation}
                  disabled={loading}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 w-full sm:w-auto"
                >
                  {loading
                    ? 'Saving...'
                    : editingRuleId
                      ? 'Update Automation Rule'
                      : 'Save Automation Rule'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
