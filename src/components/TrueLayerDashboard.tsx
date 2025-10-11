'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBankingData } from '@/contexts/BankingDataContext';
import {
  clientStorage,
  CardData,
  CardBalance,
  AccountData,
  AccountBalance,
} from '@/lib/clientStorage';
import AutomationSetup from './AutomationSetup';

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
    monzo: 'Monzo',
    'ob-monzo': 'Monzo',
    natwest: 'NatWest',
    'ob-natwest': 'NatWest',
    santander: 'Santander',
    'ob-santander': 'Santander',
    truelayer: 'TrueLayer',
  };
  return providerNames[providerId] || providerId;
};

const formatCurrency = (
  amount: number,
  currency: string,
  isMonzo: boolean = false
) => {
  // Monzo API returns amounts in pennies (minor units), so divide by 100
  const displayAmount = isMonzo ? amount / 100 : amount;

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency,
  }).format(displayAmount);
};

export default function TrueLayerDashboard() {
  const { currentUser } = useAuth();
  const { data, loading, error, loadData, removeProvider } = useBankingData();
  const [savingsExpanded, setSavingsExpanded] = useState<{
    [provider: string]: boolean;
  }>({});
  const [monzoAutomationEnabled, setMonzoAutomationEnabled] = useState<{
    [provider: string]: boolean;
  }>({});

  const [hasMonzoAutomation, setHasMonzoAutomation] = useState(false);
  const [checkingAutomation, setCheckingAutomation] = useState(false);

  // Check if Monzo automation is enabled on component mount
  useEffect(() => {
    const checkMonzoAutomation = async () => {
      if (!currentUser?.uid) return;

      const providers = Object.keys(data);
      const monzoProviders = providers.filter(
        (p) => p === 'ob-monzo' || p === 'monzo'
      );

      if (monzoProviders.length === 0) return;

      setCheckingAutomation(true);
      try {
        const response = await fetch(
          `/api/truelayer/get-user-tokens?userId=${currentUser.uid}`
        );
        if (response.ok) {
          const tokens = await response.json();
          // Check for TrueLayer Monzo token (for reading account/pot data)
          const hasTrueLayerMonzo = tokens.some(
            (t: any) => t.provider === 'ob-monzo' && !t.deleted
          );

          // Check for direct Monzo API token (for automation/write access)
          const hasMonzoAutomation = tokens.some(
            (t: any) => t.provider === 'monzo' && !t.deleted
          );

          const newState: { [provider: string]: boolean } = {};
          monzoProviders.forEach((provider) => {
            newState[provider] = hasTrueLayerMonzo;
          });
          setMonzoAutomationEnabled(newState);
          setHasMonzoAutomation(hasMonzoAutomation);
        }
      } catch (error) {
        console.error('Error checking Monzo automation status:', error);
      } finally {
        setCheckingAutomation(false);
      }
    };

    checkMonzoAutomation();
  }, [currentUser, data]);

  const handleLogout = async (provider: string) => {
    await clientStorage.removeSession(provider);
    removeProvider(provider);
  };

  const handleDisconnect = async (provider: string) => {
    await clientStorage.deleteTokens(provider);
    removeProvider(provider);
  };

  const toggleSavingsExpanded = (provider: string) => {
    setSavingsExpanded((prev) => ({
      ...prev,
      [provider]: !prev[provider],
    }));
  };

  const handleEnableMonzoAutomation = (provider: string) => {
    // Check if this is a Monzo provider
    if (provider === 'ob-monzo' || provider === 'monzo') {
      const userId = currentUser?.uid || 'anonymous';
      window.location.href = `/api/auth/monzo?userId=${userId}`;
    }
  };

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
              onClick={() => void loadData()}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-medium"
            >
              Retry
            </button>
            {isAuthError && (
              <button
                onClick={() => {
                  const userId = currentUser?.uid;
                  if (userId) {
                    window.location.href = `/api/auth/truelayer?userId=${userId}`;
                  } else {
                    console.error('No user ID available for reconnection');
                    window.location.href = '/api/auth/truelayer';
                  }
                }}
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
      <div className="border border-gray-600 bg-gray-800 p-8 rounded-lg">
        {/* Progress Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold mb-2 text-white">
            🎯 Let&apos;s Set Up Your Monzo Automation!
          </h2>
          <p className="text-gray-300 mb-6 max-w-lg mx-auto">
            Follow these 3 simple steps to automate transfers from your credit
            cards to your Monzo pot.
          </p>
        </div>

        {/* 3-Step Progress */}
        <div className="space-y-4 mb-8">
          {/* Step 1 */}
          <div className="flex items-center p-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center mr-4">
              <span className="text-white font-bold text-sm">1</span>
            </div>
            <div className="flex-grow">
              <h3 className="text-white font-medium mb-1">
                Connect Your Monzo Account
              </h3>
              <p className="text-gray-300 text-sm">
                Link your Monzo account to enable pot transfers and automation
              </p>
            </div>
            <button
              onClick={() => {
                const userId = currentUser?.uid || 'anonymous';
                window.location.href = `/api/auth/monzo?userId=${userId}`;
              }}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-medium transition-colors"
            >
              Connect Monzo
            </button>
          </div>

          {/* Step 2 */}
          <div className="flex items-center p-4 bg-gray-700/50 border border-gray-600 rounded-lg opacity-60">
            <div className="flex-shrink-0 w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center mr-4">
              <span className="text-gray-300 font-bold text-sm">2</span>
            </div>
            <div className="flex-grow">
              <h3 className="text-gray-300 font-medium mb-1">
                Add Credit Cards & Other Accounts
              </h3>
              <p className="text-gray-400 text-sm">
                Connect your credit cards and other bank accounts to track
                spending
              </p>
            </div>
            <button
              disabled
              className="bg-gray-600 text-gray-400 px-6 py-2 rounded-lg font-medium cursor-not-allowed"
            >
              Complete Step 1 First
            </button>
          </div>

          {/* Step 3 */}
          <div className="flex items-center p-4 bg-gray-700/50 border border-gray-600 rounded-lg opacity-60">
            <div className="flex-shrink-0 w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center mr-4">
              <span className="text-gray-300 font-bold text-sm">3</span>
            </div>
            <div className="flex-grow">
              <h3 className="text-gray-300 font-medium mb-1">
                Set Up Automation Rules
              </h3>
              <p className="text-gray-400 text-sm">
                Configure automatic transfers to your Monzo pot based on your
                spending
              </p>
            </div>
            <button
              disabled
              className="bg-gray-600 text-gray-400 px-6 py-2 rounded-lg font-medium cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>
        </div>

        {/* Security Note */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            🔒 Your data is secure and encrypted. We use bank-grade security to
            protect your information.
          </p>
        </div>
      </div>
    );
  }

  // Collect all accounts and cards from all providers
  const allAccounts: (AccountData & {
    balance?: AccountBalance;
    provider: string;
  })[] = [];
  const allCards: (CardData & { balance?: CardBalance; provider: string })[] =
    [];

  providers.forEach((provider) => {
    const providerData = data[provider];
    providerData.accounts.forEach((account) => {
      allAccounts.push({ ...account, provider } as AccountData & {
        balance?: AccountBalance;
        provider: string;
      });
    });
    providerData.cards.forEach((card) => {
      allCards.push({ ...card, provider } as CardData & {
        balance?: CardBalance;
        provider: string;
      });
    });
  });

  // Determine progress steps
  const hasMonzoAccount = providers.includes('monzo');
  const hasCreditCards = allCards.length > 0;
  const hasOtherAccounts = allAccounts.some((acc) => acc.provider !== 'monzo');

  const step1Complete = hasMonzoAccount;
  const step2Complete = hasCreditCards || hasOtherAccounts;
  const step3Complete = false; // Will be implemented later

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Financial Dashboard</h1>
        <button
          onClick={() => void loadData(true)}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Refreshing...' : '🔄 Refresh Data'}
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
          <span className="mr-2">🎯</span>
          Setup Progress
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <div
            className={`flex items-center p-3 rounded-lg border ${
              step1Complete
                ? 'bg-green-600/20 border-green-500/30'
                : 'bg-gray-700/50 border-gray-600'
            }`}
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                step1Complete ? 'bg-green-600' : 'bg-gray-600'
              }`}
            >
              {step1Complete ? (
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <span className="text-white font-bold text-sm">1</span>
              )}
            </div>
            <div>
              <h3
                className={`font-medium text-sm ${step1Complete ? 'text-green-300' : 'text-gray-300'}`}
              >
                Monzo Connected
              </h3>
              <p className="text-xs text-gray-400">Direct Monzo account</p>
            </div>
          </div>

          {/* Step 2 */}
          <div
            className={`flex items-center p-3 rounded-lg border ${
              step2Complete
                ? 'bg-green-600/20 border-green-500/30'
                : step1Complete
                  ? 'bg-blue-600/20 border-blue-500/30'
                  : 'bg-gray-700/50 border-gray-600'
            }`}
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                step2Complete
                  ? 'bg-green-600'
                  : step1Complete
                    ? 'bg-blue-600'
                    : 'bg-gray-600'
              }`}
            >
              {step2Complete ? (
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <span className="text-white font-bold text-sm">2</span>
              )}
            </div>
            <div>
              <h3
                className={`font-medium text-sm ${
                  step2Complete
                    ? 'text-green-300'
                    : step1Complete
                      ? 'text-blue-300'
                      : 'text-gray-300'
                }`}
              >
                Cards & Accounts
              </h3>
              <p className="text-xs text-gray-400">
                Credit cards & other banks
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div
            className={`flex items-center p-3 rounded-lg border ${
              step3Complete
                ? 'bg-green-600/20 border-green-500/30'
                : step2Complete
                  ? 'bg-blue-600/20 border-blue-500/30'
                  : 'bg-gray-700/50 border-gray-600'
            }`}
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                step3Complete
                  ? 'bg-green-600'
                  : step2Complete
                    ? 'bg-blue-600'
                    : 'bg-gray-600'
              }`}
            >
              {step3Complete ? (
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <span className="text-white font-bold text-sm">3</span>
              )}
            </div>
            <div>
              <h3
                className={`font-medium text-sm ${
                  step3Complete
                    ? 'text-green-300'
                    : step2Complete
                      ? 'text-blue-300'
                      : 'text-gray-300'
                }`}
              >
                Automation Rules
              </h3>
              <p className="text-xs text-gray-400">Set up pot transfers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Add More Accounts Button */}
      {step1Complete && (
        <div className="border border-blue-600 bg-gray-800 p-6 rounded-lg text-center">
          <h2 className="text-xl font-semibold mb-3 text-blue-400">
            Step 2: Add More Accounts
          </h2>
          <p className="text-gray-300 mb-4">
            Connect your credit cards and other bank accounts to track spending
            and enable automation.
          </p>
          <button
            onClick={() => {
              const userId = currentUser?.uid || 'anonymous';
              window.location.href = `/api/auth/truelayer?userId=${userId}`;
            }}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
          >
            Add Credit Cards & Other Banks
          </button>
        </div>
      )}

      {/* 1. Monzo Account Section (Priority) */}
      {hasMonzoAccount &&
        (() => {
          const monzoData = data['monzo'];
          if (!monzoData || monzoData.accounts.length === 0) return null;

          const monzoTransactionAccounts = monzoData.accounts.filter(
            (account) =>
              account.product_type === 'standard' ||
              account.account_type === 'TRANSACTION'
          );
          const monzoSavingsAccounts = monzoData.accounts.filter(
            (account) =>
              account.product_type === 'rewards' ||
              account.account_type === 'SAVINGS'
          );
          const isSavingsExpanded = savingsExpanded['monzo'] || false;

          return (
            <div className="border border-purple-600 bg-gradient-to-r from-purple-900/20 to-blue-900/20 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-purple-400 mb-4 flex items-center">
                <span className="mr-2">🏦</span>
                Monzo Account (Direct)
              </h2>

              <div className="border border-gray-600 bg-gray-700 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">Monzo</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLogout('monzo')}
                      className="bg-gray-500 text-white px-2 py-1 rounded text-xs hover:bg-gray-600 font-medium"
                      title="Clear session (tokens remain saved)"
                    >
                      Logout
                    </button>
                    <button
                      onClick={() => handleDisconnect('monzo')}
                      className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 font-medium"
                      title="Permanently disconnect account"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* Monzo Automation Status */}
                <div
                  className={`mb-4 p-3 border rounded ${
                    monzoAutomationEnabled['monzo']
                      ? 'bg-green-900/30 border-green-600'
                      : 'bg-blue-900/30 border-blue-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4
                        className={`text-sm font-semibold mb-1 ${
                          hasMonzoAutomation
                            ? 'text-green-300'
                            : 'text-blue-300'
                        }`}
                      >
                        {hasMonzoAutomation
                          ? '✅ Automated Pot Transfers Enabled'
                          : '🤖 Automated Pot Transfers'}
                      </h4>
                      <p className="text-xs text-gray-300">
                        {hasMonzoAutomation
                          ? 'Funds will be automatically transferred to your Credit Card pot every night at 2 AM'
                          : 'Enable write access to automatically transfer funds to your Credit Card pot'}
                      </p>
                    </div>
                    {!hasMonzoAutomation && (
                      <button
                        onClick={() => handleEnableMonzoAutomation('monzo')}
                        disabled={checkingAutomation}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium text-sm whitespace-nowrap ml-4 disabled:opacity-50"
                      >
                        {checkingAutomation
                          ? 'Checking...'
                          : 'Enable Automation'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Transaction Accounts */}
                {monzoTransactionAccounts.length > 0 && (
                  <div className="space-y-3">
                    {monzoTransactionAccounts.map((account) => (
                      <div
                        key={account.id || account.account_id}
                        className="bg-gray-600 p-3 rounded border border-gray-500"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-white">
                            {account.product_type === 'standard'
                              ? 'Current Account'
                              : account.product_type === 'rewards'
                                ? 'Rewards Account'
                                : account.display_name || 'Monzo Account'}
                          </h4>
                          <div className="flex items-center gap-2">
                            {account.account_number && (
                              <span className="text-xs text-gray-400">
                                ****{account.account_number.slice(-4)}
                              </span>
                            )}
                          </div>
                        </div>

                        {account.balance ? (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-400">Available Balance</p>
                              <p className="font-semibold text-lg text-white">
                                {formatCurrency(
                                  account.balance.available ||
                                    account.balance.balance ||
                                    0,
                                  account.balance.currency || account.currency,
                                  true // isMonzo
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400">Current Balance</p>
                              <p className="font-semibold text-white">
                                {formatCurrency(
                                  account.balance.current ||
                                    account.balance.balance ||
                                    0,
                                  account.balance.currency || account.currency,
                                  true // isMonzo
                                )}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-gray-400 text-sm">
                              Loading balance...
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Pots / Savings Section */}
                {monzoSavingsAccounts.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => toggleSavingsExpanded('monzo')}
                      className="flex items-center justify-between w-full text-left mb-2"
                    >
                      <h4 className="text-md font-medium text-white">
                        Pots / Savings ({monzoSavingsAccounts.length})
                      </h4>
                      <span className="text-gray-400">
                        {isSavingsExpanded ? '▼' : '▶'}
                      </span>
                    </button>

                    {isSavingsExpanded && (
                      <div className="space-y-2">
                        {monzoSavingsAccounts.map((account) => (
                          <div
                            key={account.id || account.account_id}
                            className="bg-gray-600 p-3 rounded border border-gray-500"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium text-white">
                                {account.product_type === 'rewards'
                                  ? 'Rewards Pot'
                                  : account.description ||
                                    account.display_name ||
                                    'Pot'}
                              </h5>
                              {account.account_number && (
                                <span className="text-xs text-gray-400">
                                  ****{account.account_number.slice(-4)}
                                </span>
                              )}
                            </div>

                            {account.balance ? (
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-400">
                                    Available Balance
                                  </p>
                                  <p className="font-semibold text-white">
                                    {formatCurrency(
                                      account.balance.available ||
                                        account.balance.balance ||
                                        0,
                                      account.balance.currency ||
                                        account.currency,
                                      true // isMonzo
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-400">
                                    Current Balance
                                  </p>
                                  <p className="font-semibold text-white">
                                    {formatCurrency(
                                      account.balance.current ||
                                        account.balance.balance ||
                                        0,
                                      account.balance.currency ||
                                        account.currency,
                                      true // isMonzo
                                    )}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-gray-400 text-sm">
                                Loading balance...
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {/* Credit Cards Section */}
      {allCards.length > 0 && (
        <div className="border border-green-600 bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-green-400 mb-4">
            💳 Credit Cards
          </h2>
          <div className="space-y-3">
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
                  className="bg-gray-700 p-4 rounded-lg border border-gray-600"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">
                        {card.display_name}
                      </h4>
                      <span className="text-xs text-gray-500 bg-gray-600 px-2 py-1 rounded">
                        {getProviderDisplayName(card.provider)}
                      </span>
                    </div>
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
                    <p className="text-gray-400 text-sm">Loading balance...</p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 3. Other Bank Accounts Section */}
      {(() => {
        const otherProviders = providers.filter((provider) => {
          const providerData = data[provider];
          return provider !== 'monzo' && providerData.accounts.length > 0;
        });

        if (otherProviders.length === 0) return null;

        return (
          <div className="border border-gray-600 bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-gray-300 mb-4 flex items-center">
              <span className="mr-2">🏛️</span>
              Other Bank Accounts
            </h2>

            <div className="space-y-4">
              {otherProviders.map((provider) => {
                const providerData = data[provider];
                const providerTransactionAccounts =
                  providerData.accounts.filter(
                    (account) => account.account_type === 'TRANSACTION'
                  );
                const providerSavingsAccounts = providerData.accounts.filter(
                  (account) => account.account_type === 'SAVINGS'
                );
                const isSavingsExpanded = savingsExpanded[provider] || false;

                // Only show if there are transaction accounts or savings accounts
                if (
                  providerTransactionAccounts.length === 0 &&
                  providerSavingsAccounts.length === 0
                )
                  return null;

                return (
                  <div
                    key={provider}
                    className="border border-gray-600 bg-gray-700 p-4 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-white">
                        {getProviderDisplayName(provider)}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleLogout(provider)}
                          className="bg-gray-500 text-white px-2 py-1 rounded text-xs hover:bg-gray-600 font-medium"
                          title="Clear session (tokens remain saved)"
                        >
                          Logout
                        </button>
                        <button
                          onClick={() => handleDisconnect(provider)}
                          className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 font-medium"
                          title="Permanently disconnect account"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>

                    {/* Monzo Automation Status for ob-monzo */}
                    {provider === 'ob-monzo' && (
                      <div
                        className={`mb-4 p-3 border rounded ${
                          monzoAutomationEnabled[provider]
                            ? 'bg-green-900/30 border-green-600'
                            : 'bg-blue-900/30 border-blue-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4
                              className={`text-sm font-semibold mb-1 ${
                                hasMonzoAutomation
                                  ? 'text-green-300'
                                  : 'text-blue-300'
                              }`}
                            >
                              {hasMonzoAutomation
                                ? '✅ Automated Pot Transfers Enabled'
                                : '🤖 Automated Pot Transfers'}
                            </h4>
                            <p className="text-xs text-gray-300">
                              {hasMonzoAutomation
                                ? 'Funds will be automatically transferred to your Credit Card pot every night at 2 AM'
                                : 'Enable write access to automatically transfer funds to your Credit Card pot'}
                            </p>
                          </div>
                          {!hasMonzoAutomation && (
                            <button
                              onClick={() =>
                                handleEnableMonzoAutomation(provider)
                              }
                              disabled={checkingAutomation}
                              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium text-sm whitespace-nowrap ml-4 disabled:opacity-50"
                            >
                              {checkingAutomation
                                ? 'Checking...'
                                : 'Enable Automation'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Transaction Accounts */}
                    {providerTransactionAccounts.length > 0 && (
                      <div className="space-y-3">
                        {providerTransactionAccounts.map((account) => (
                          <div
                            key={account.account_id}
                            className="bg-gray-600 p-3 rounded border border-gray-500"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-white">
                                {account.display_name}
                              </h4>
                              <span className="text-xs text-gray-400">
                                {account.account_type}
                              </span>
                            </div>

                            {account.balance ? (
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-400">
                                    Available Balance
                                  </p>
                                  <p className="font-semibold text-lg text-white">
                                    {formatCurrency(
                                      account.balance.available,
                                      account.balance.currency
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-400">
                                    Current Balance
                                  </p>
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
                                Loading balance...
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pots / Savings Section */}
                    {providerSavingsAccounts.length > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={() => toggleSavingsExpanded(provider)}
                          className="flex items-center justify-between w-full text-left mb-2"
                        >
                          <h4 className="text-md font-medium text-white">
                            Pots / Savings ({providerSavingsAccounts.length})
                          </h4>
                          <span className="text-gray-400">
                            {isSavingsExpanded ? '▼' : '▶'}
                          </span>
                        </button>

                        {isSavingsExpanded && (
                          <div className="space-y-2">
                            {providerSavingsAccounts.map((account) => (
                              <div
                                key={account.account_id}
                                className="bg-gray-600 p-3 rounded border border-gray-500"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="font-medium text-white">
                                    {account.display_name}
                                  </h5>
                                  <span className="text-xs text-gray-400">
                                    {account.account_type}
                                  </span>
                                </div>

                                {account.balance ? (
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-gray-400">
                                        Available Balance
                                      </p>
                                      <p className="font-semibold text-white">
                                        {formatCurrency(
                                          account.balance.available,
                                          account.balance.currency
                                        )}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-400">
                                        Current Balance
                                      </p>
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
                                    Loading balance...
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Step 3: Automation Setup */}
      {step2Complete && <AutomationSetup />}
    </div>
  );
}
