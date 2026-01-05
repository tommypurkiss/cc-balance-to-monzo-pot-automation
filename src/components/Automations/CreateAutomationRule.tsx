import { CardData, CardBalance } from '@/lib/clientStorage';
import { formatCurrency } from '@/shared-utils/formatCurrency';
import { getProviderDisplayName } from '@/shared-utils/getProviderNames';
import { AutomationRule } from '@/types/automationRules';
import { MonzoPot } from '@/types/monzoPot';
import { User } from 'firebase/auth';

interface CreateAdditionalRuleProps {
  currentUser: User | null;
  existingRules: AutomationRule[];
  editingRuleId: string | null;
  selectedCards: string[];
  step: number;
  minimumBankBalance: number;
  uniqueCards: (CardData & {
    balance?: CardBalance;
    provider: string;
  })[];
  pots: MonzoPot[];
  selectedPot: string;
  loading: boolean;
  error: string | null; // Add this

  // functions
  onCancelEdit: () => void;
  onCardToggle: (cardId: string) => void;
  onSelectAllCards: () => void;
  onNext: () => void;
  onBack: () => void;
  onSetSelectedPot: (potId: string) => void;
  onSetMinimumBankBalance: (balance: number) => void;
  onSaveAutomation: () => void;
}

export default function CreateAdditionalRule({
  currentUser,
  existingRules,
  editingRuleId,
  selectedCards,
  step,
  minimumBankBalance,
  uniqueCards,
  pots,
  selectedPot,
  loading,
  error,
  onCancelEdit,
  onCardToggle,
  onSelectAllCards,
  onNext,
  onBack,
  onSetSelectedPot,
  onSetMinimumBankBalance,
  onSaveAutomation,
}: CreateAdditionalRuleProps) {
  return (
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
            onClick={onCancelEdit}
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
            Choose which credit cards should be included in the automation. The
            system will transfer funds based on the total balance of selected
            cards.
          </p>

          <div className="mb-4">
            <button
              onClick={onSelectAllCards}
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
                  onChange={() => onCardToggle(card.account_id)}
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
              onClick={onNext}
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
          ) : error && error.includes('Direct Monzo API access required') ? (
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
                  To set up automation, you need to connect your Monzo account
                  with write access. This allows the system to transfer funds to
                  your pots.
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
                    onChange={(e) => onSetSelectedPot(e.target.value)}
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
              onClick={editingRuleId ? onCancelEdit : onBack}
              className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium w-full sm:w-auto"
            >
              {editingRuleId ? 'Cancel' : 'Back'}
            </button>
            <button
              onClick={onNext}
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
            Set a minimum balance threshold to prevent transfers when your main
            account balance is too low.
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
                  onSetMinimumBankBalance(
                    Math.max(0, parseFloat(e.target.value) * 100)
                  )
                }
                min="0"
                step="0.01"
                className="bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 w-32"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Transfers will be skipped if your main account balance is at or
              below this amount.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6">
            <button
              onClick={onBack}
              className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium w-full sm:w-auto"
            >
              Back
            </button>
            <button
              onClick={onNext}
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
              onClick={onBack}
              className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium w-full sm:w-auto"
            >
              Back
            </button>
            <button
              onClick={onSaveAutomation}
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
  );
}
