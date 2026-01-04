import { CardData, CardBalance } from '@/lib/clientStorage';
import { formatCurrency } from '@/shared-utils/formatCurrency';
import { getProviderDisplayName } from '@/shared-utils/getProviderNames';
import { User } from 'firebase/auth';

interface CreditCardsSectionProps {
  allCards: (CardData & {
    balance?: CardBalance;
    provider: string;
  })[];
  currentUser: User | null;
}

export default function CreditCardsSection({
  allCards,
  currentUser,
}: CreditCardsSectionProps) {
  return (
    <div className="border border-green-600 bg-gray-800 p-4 sm:p-6 rounded-lg">
      <div className="flex justify-between items-center pb-2">
        <h2 className="text-lg sm:text-xl font-semibold text-green-400 mb-">
          💳 Credit Cards
        </h2>
        <button
          onClick={() => {
            const userId = currentUser?.uid || 'anonymous';
            window.location.href = `/api/auth/truelayer?userId=${userId}`;
          }}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          Add More
        </button>
      </div>

      <div className="space-y-4">
        {allCards
          .filter(
            (card, index, self) =>
              // Deduplicate by account_id and partial_card_number
              index ===
              self.findIndex(
                (c) =>
                  c.account_id === card.account_id &&
                  c.partial_card_number === card.partial_card_number
              )
          )
          .map((card) => (
            <div
              key={card.account_id}
              className="bg-gray-700/50 p-4 rounded-lg border border-gray-600"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <h4 className="font-medium text-white text-lg">
                    {card.display_name}
                  </h4>
                  <span className="text-xs text-gray-500 bg-gray-600 px-2 py-1 rounded w-fit">
                    {getProviderDisplayName(card.provider)}
                  </span>
                </div>
                <span className="text-sm text-gray-400">
                  ****{card.partial_card_number}
                </span>
              </div>

              {card.balance ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">
                      Current Balance
                    </span>
                    <span className="font-semibold text-xl text-white">
                      {formatCurrency(
                        card.balance.current,
                        card.balance.currency
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Credit Limit</span>
                    <span className="font-semibold text-white">
                      {formatCurrency(
                        card.balance.credit_limit,
                        card.balance.currency
                      )}
                    </span>
                  </div>
                  {card.balance.available !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">
                        Available Credit
                      </span>
                      <span className="font-semibold text-green-400">
                        {formatCurrency(
                          card.balance.available,
                          card.balance.currency
                        )}
                      </span>
                    </div>
                  )}
                  {card.balance.payment_due_date && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Payment Due</span>
                      <span className="font-semibold text-white">
                        {new Date(
                          card.balance.payment_due_date
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Loading balance...</p>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
