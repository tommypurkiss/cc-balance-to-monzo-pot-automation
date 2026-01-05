import { formatCurrency } from '@/shared-utils/formatCurrency';
import { AutomationRule } from '@/types/automationRules';

interface ExistingAutomationRulesListProps {
  existingRules: AutomationRule[];
  loading: boolean;
  onEditRule: (rule: AutomationRule) => void;
  onDeleteRule: (ruleId: string) => void;
}

export default function ExistingAutomationRulesList({
  existingRules,
  loading,
  onEditRule,
  onDeleteRule,
}: ExistingAutomationRulesListProps) {
  return (
    <div className="flex flex-col gap-y-2">
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
              onClick={() => onEditRule(rule)}
              className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium w-full sm:w-auto"
            >
              Edit Rule
            </button>
            <button
              onClick={() => onDeleteRule(rule.id || '')}
              disabled={loading}
              className="bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 w-full sm:w-auto"
            >
              {loading ? 'Deleting...' : 'Delete Rule'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
