'use client';

import { useState, useEffect } from 'react';
import {
  clientStorage,
  CardData,
  CardBalance,
  AccountData,
  AccountBalance,
} from '@/lib/clientStorage';

interface ProviderData {
  cards: (CardData & { balance?: CardBalance })[];
  accounts: (AccountData & { balance?: AccountBalance })[];
}

const getProviderDisplayName = (providerId: string) => {
  const providerNames: { [key: string]: string } = {
    amex: 'American Express',
    'ob-amex': 'American Express',
    barclaycard: 'Barclaycard',
    'ob-barclaycard': 'Barclaycard',
    hsbc: 'HSBC',
    'ob-hsbc': 'HSBC',
    lloyds: 'Lloyds Bank',
    'ob-lloyds': 'Lloyds Bank',
    natwest: 'NatWest',
    'ob-natwest': 'NatWest',
    santander: 'Santander',
    'ob-santander': 'Santander',
    truelayer: 'TrueLayer',
  };
  return providerNames[providerId] || providerId;
};

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export default function TrueLayerDashboard() {
  const [data, setData] = useState<{ [provider: string]: ProviderData }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Initialize sessions and load all data
      clientStorage.initializeSessions();
      const allData = await clientStorage.getAllData();
      setData(allData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Check if it's an authentication error
      if (
        errorMessage.includes('invalid_token') ||
        errorMessage.includes('401') ||
        errorMessage.includes('unauthorized')
      ) {
        setError(
          'Your bank connections have expired. Please reconnect your accounts to continue.'
        );
        // Clear old data when authentication fails
        setData({});
      } else {
        setError('Failed to load data: ' + errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async (provider: string) => {
    await clientStorage.removeSession(provider);
    setData((prev) => {
      const newData = { ...prev };
      delete newData[provider];
      return newData;
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="border border-blue-600 bg-gray-800 p-6 rounded-lg">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          <span className="ml-3 text-gray-300">Loading financial data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    const isAuthError =
      error.includes('expired') || error.includes('reconnect');

    return (
      <div className="border border-red-600 bg-gray-800 p-6 rounded-lg">
        <div className="text-red-400">
          <p className="font-medium mb-2">Error loading data:</p>
          <p className="text-sm mb-4 text-gray-300">{error}</p>
          <div className="flex space-x-3">
            <button
              onClick={loadData}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-medium"
            >
              Retry
            </button>
            {isAuthError && (
              <button
                onClick={() =>
                  (window.location.href = '/api/auth/truelayer/login')
                }
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
              >
                Reconnect Banks
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const providers = Object.keys(data);
  if (providers.length === 0) {
    return (
      <div className="border border-gray-600 bg-gray-800 p-6 rounded-lg text-center">
        <h2 className="text-xl font-semibold mb-3 text-white">
          No Connected Accounts
        </h2>
        <p className="text-gray-300 mb-4">
          Connect your bank accounts to view balances and transactions.
        </p>
        <button
          onClick={() => (window.location.href = '/api/auth/truelayer/login')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          Connect Bank Account
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Always show connect button */}
      <div className="border border-blue-600 bg-gray-800 p-6 rounded-lg text-center">
        <h2 className="text-xl font-semibold mb-3 text-blue-400">
          Connect More Banks
        </h2>
        <p className="text-gray-300 mb-4">
          Connect additional bank accounts through TrueLayer to view balances
          and transactions.
        </p>
        <button
          onClick={() => (window.location.href = '/api/auth/truelayer/login')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          Connect Bank Account
        </button>
      </div>

      {providers.map((provider) => {
        const providerData = data[provider];
        const hasCards = providerData.cards.length > 0;
        const hasAccounts = providerData.accounts.length > 0;

        if (!hasCards && !hasAccounts) return null;

        return (
          <div
            key={provider}
            className="border border-green-600 bg-gray-800 p-6 rounded-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-green-400">
                💳 {getProviderDisplayName(provider)}
              </h2>
              <button
                onClick={() => handleLogout(provider)}
                className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 font-medium"
              >
                Logout
              </button>
            </div>

            {/* Cards Section */}
            {hasCards && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-white mb-3">
                  Credit Cards
                </h3>
                <div className="space-y-3">
                  {providerData.cards.map((card) => (
                    <div
                      key={card.account_id}
                      className="bg-gray-700 p-4 rounded-lg border border-gray-600"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-white">
                          {card.display_name}
                        </h4>
                        <span className="text-sm text-gray-400">
                          ****{card.partial_card_number}
                        </span>
                      </div>

                      {card.balance ? (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-400">Current Balance</p>
                            <p className="font-semibold text-lg text-white">
                              {formatCurrency(
                                card.balance.current,
                                card.balance.currency
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">Credit Limit</p>
                            <p className="font-semibold text-white">
                              {formatCurrency(
                                card.balance.credit_limit,
                                card.balance.currency
                              )}
                            </p>
                          </div>
                          {card.balance.available !== undefined && (
                            <div>
                              <p className="text-gray-400">Available Credit</p>
                              <p className="font-semibold text-green-400">
                                {formatCurrency(
                                  card.balance.available,
                                  card.balance.currency
                                )}
                              </p>
                            </div>
                          )}
                          {card.balance.payment_due_date && (
                            <div>
                              <p className="text-gray-400">Payment Due</p>
                              <p className="font-semibold text-white">
                                {new Date(
                                  card.balance.payment_due_date
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">
                          Balance unavailable
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accounts Section */}
            {hasAccounts && (
              <div>
                <h3 className="text-lg font-medium text-white mb-3">
                  Bank Accounts
                </h3>
                <div className="space-y-3">
                  {providerData.accounts.map((account) => (
                    <div
                      key={account.account_id}
                      className="bg-gray-700 p-4 rounded-lg border border-gray-600"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-white">
                          {account.display_name}
                        </h4>
                        <span className="text-sm text-gray-400">
                          {account.account_type}
                        </span>
                      </div>

                      {account.balance ? (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-400">Available Balance</p>
                            <p className="font-semibold text-lg text-white">
                              {formatCurrency(
                                account.balance.available,
                                account.balance.currency
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">Current Balance</p>
                            <p className="font-semibold text-white">
                              {formatCurrency(
                                account.balance.current,
                                account.balance.currency
                              )}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">
                          Balance unavailable
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
