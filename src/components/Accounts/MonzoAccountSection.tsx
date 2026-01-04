import { BankingData } from '@/contexts/BankingDataContext';
import { AccountData, AccountBalance } from '@/lib/clientStorage';
import { formatCurrency } from '@/shared-utils/formatCurrency';
import { User } from 'firebase/auth';
import { useState, useEffect } from 'react';

interface MonzoAccountSectionProps {
  data: BankingData;
  currentUser: User | null;
}

export default function MonzoAccountSection({
  data,
  currentUser,
}: MonzoAccountSectionProps) {
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

  const handleEnableMonzoAutomation = (provider: string) => {
    // Check if this is a Monzo provider
    if (provider === 'ob-monzo' || provider === 'monzo') {
      const userId = currentUser?.uid || 'anonymous';
      window.location.href = `/api/auth/monzo?userId=${userId}`;
    }
  };

  const monzoData = data['monzo'];

  if (!monzoData || monzoData.accounts.length === 0) return null;

  const monzoTransactionAccounts = monzoData.accounts.filter(
    (account) =>
      account.product_type === 'standard' ||
      account.account_type === 'TRANSACTION' ||
      account.type === 'uk_retail' ||
      account.type === 'uk_monzo_flex'
  );
  const monzoSavingsAccounts = monzoData.accounts.filter(
    (account) =>
      account.product_type === 'rewards' || account.account_type === 'SAVINGS'
  );
  let isSavingsExpanded = false;

  return (
    <div className="border border-purple-600 bg-gradient-to-r from-purple-900/20 to-blue-900/20 p-4 sm:p-6 rounded-lg">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
        <h2 className="text-lg sm:text-xl font-semibold text-purple-400 flex items-center">
          <span className="mr-2">🏦</span>
          Monzo Account (Direct)
        </h2>
        <div className="flex gap-2">
          <button
            // onClick={() => handleLogout('monzo')}
            className="bg-gray-500 text-white px-3 py-2 rounded text-sm hover:bg-gray-600 font-medium"
            title="Clear session (tokens remain saved)"
          >
            Logout
          </button>
          <button
            // onClick={() => handleDisconnect('monzo')}
            className="bg-red-500 text-white px-3 py-2 rounded text-sm hover:bg-red-600 font-medium"
            title="Permanently disconnect account"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Mobile-optimized Monzo Automation Status */}
      <div
        className={`mb-4 p-4 border rounded-lg ${
          monzoAutomationEnabled['monzo']
            ? 'bg-green-900/30 border-green-600'
            : 'bg-blue-900/30 border-blue-600'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1">
            <h4
              className={`text-sm font-semibold mb-2 ${
                hasMonzoAutomation ? 'text-green-300' : 'text-blue-300'
              }`}
            >
              {hasMonzoAutomation
                ? '✅ Automated Pot Transfers Enabled'
                : '🤖 Automated Pot Transfers'}
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed">
              {hasMonzoAutomation
                ? 'Funds will be automatically transferred to your Credit Card pot every night at 2 AM'
                : 'Enable write access to automatically transfer funds to your Credit Card pot'}
            </p>
          </div>
          {!hasMonzoAutomation && (
            <button
              onClick={() => handleEnableMonzoAutomation('monzo')}
              disabled={checkingAutomation}
              className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium text-sm w-full sm:w-auto disabled:opacity-50"
            >
              {checkingAutomation ? 'Checking...' : 'Enable Automation'}
            </button>
          )}
        </div>
      </div>

      {/* Mobile-optimized Transaction Accounts */}
      {monzoTransactionAccounts.length > 0 && (
        <div className="space-y-4">
          {monzoTransactionAccounts.map((account) => (
            <div
              key={account.id || account.account_id}
              className="bg-gray-700/50 p-4 rounded-lg border border-gray-600"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                <h4 className="font-medium text-white text-lg">
                  {account.type === 'uk_monzo_flex'
                    ? 'Monzo Flex'
                    : account.product_type === 'standard' ||
                        account.type === 'uk_retail'
                      ? 'Current Account'
                      : account.product_type === 'rewards'
                        ? 'Rewards Account'
                        : account.display_name || 'Monzo Account'}
                </h4>
                {account.account_number && (
                  <span className="text-sm text-gray-400">
                    ****{account.account_number.slice(-4)}
                  </span>
                )}
              </div>

              {account.balance ? (
                <div className="space-y-3">
                  {account.type === 'uk_monzo_flex' ? (
                    // For Flex accounts, show amount owed (credit balance)
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">
                          Amount Owed
                        </span>
                        <span className="font-semibold text-xl text-white">
                          {formatCurrency(
                            Math.abs(
                              account.balance.current ||
                                account.balance.balance ||
                                account.balance.available ||
                                0
                            ),
                            account.balance.currency || account.currency,
                            true // isMonzo
                          )}
                        </span>
                      </div>
                      {account.balance.available !== undefined &&
                        account.balance.available !==
                          (account.balance.current ||
                            account.balance.balance) && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">
                              Available Credit
                            </span>
                            <span className="font-semibold text-green-400">
                              {formatCurrency(
                                account.balance.available,
                                account.balance.currency || account.currency,
                                true // isMonzo
                              )}
                            </span>
                          </div>
                        )}
                    </>
                  ) : (
                    // For regular accounts, show available and current balance
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">
                          Available Balance
                        </span>
                        <span className="font-semibold text-xl text-white">
                          {formatCurrency(
                            account.balance.available ||
                              account.balance.balance ||
                              0,
                            account.balance.currency || account.currency,
                            true // isMonzo
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">
                          Current Balance
                        </span>
                        <span className="font-semibold text-white">
                          {formatCurrency(
                            account.balance.current ||
                              account.balance.balance ||
                              0,
                            account.balance.currency || account.currency,
                            true // isMonzo
                          )}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-400 text-sm">Loading balance...</p>
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
            onClick={() => (isSavingsExpanded = !isSavingsExpanded)}
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
                        : account.description || account.display_name || 'Pot'}
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
                        <p className="text-gray-400">Available Balance</p>
                        <p className="font-semibold text-white">
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
                    <p className="text-gray-400 text-sm">Loading balance...</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
