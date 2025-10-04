'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { clientStorage } from '@/lib/clientStorage';

export default function DebugPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<{
    truelayer: boolean;
    monzo: boolean;
  }>({ truelayer: false, monzo: false });
  const [oauthResults, setOauthResults] = useState<{
    connected?: string;
    provider?: string;
    hasAccessToken?: boolean;
    hasRefreshToken?: boolean;
    expiresIn?: string;
    expiresAt?: string;
    error?: string;
    errorMessage?: string;
  } | null>(null);

  useEffect(() => {
    // Check for OAuth callback results
    const truelayerSuccess = searchParams.get('truelayer_success');
    const provider = searchParams.get('provider');
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const expiresIn = searchParams.get('expires_in');
    const expiresAt = searchParams.get('expires_at');
    const truelayerError = searchParams.get('truelayer_error');
    const errorMessage = searchParams.get('error_message');

    const results = {
      connected: truelayerSuccess || undefined,
      provider: provider || undefined,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      expiresIn: expiresIn || undefined,
      expiresAt: expiresAt || undefined,
      error: truelayerError || undefined,
      errorMessage: errorMessage || undefined,
    };

    // Only set results if we have some OAuth data
    if (truelayerSuccess || truelayerError || provider) {
      setOauthResults(results);
    }

    // Clean up URL parameters
    if (truelayerSuccess || truelayerError) {
      const url = new URL(window.location.href);
      url.searchParams.delete('truelayer_success');
      url.searchParams.delete('provider');
      url.searchParams.delete('access_token');
      url.searchParams.delete('refresh_token');
      url.searchParams.delete('expires_in');
      url.searchParams.delete('expires_at');
      url.searchParams.delete('truelayer_error');
      url.searchParams.delete('error_message');
      window.history.replaceState({}, document.title, url.pathname);
    }
  }, [searchParams]);

  // Load connection status
  useEffect(() => {
    const loadConnectionStatus = async () => {
      try {
        // Initialize sessions first to load from Firestore
        await clientStorage.initializeSessions();

        // Check if we have any sessions (this won't throw an error)
        const hasTrueLayer = clientStorage.hasSessions();

        // Check if Monzo is connected through TrueLayer
        let hasMonzo = false;
        if (hasTrueLayer) {
          try {
            // Only call getAllData if we have sessions
            const data = await clientStorage.getAllData();
            console.log('🔍 Debug: Checking for Monzo in data:', data);

            for (const providerData of Object.values(data)) {
              if (providerData.accounts) {
                console.log(
                  '🔍 Debug: Checking accounts:',
                  providerData.accounts
                );
                const monzoAccounts = providerData.accounts.filter(
                  (account) => {
                    console.log('🔍 Debug: Account provider info:', {
                      provider_id: account.provider_id,
                      provider: account.provider,
                      display_name: account.display_name,
                    });
                    return (
                      account.provider_id === 'ob-monzo' ||
                      account.provider?.provider_id === 'ob-monzo' ||
                      account.provider_id === 'monzo' ||
                      account.provider?.provider_id === 'monzo' ||
                      account.display_name?.toLowerCase().includes('monzo')
                    );
                  }
                );
                console.log('🔍 Debug: Found Monzo accounts:', monzoAccounts);
                if (monzoAccounts.length > 0) {
                  hasMonzo = true;
                  break;
                }
              }
            }
          } catch (dataError) {
            // If getAllData fails, we still know we have sessions, so TrueLayer is connected
            console.warn(
              'Could not load account data, but sessions exist:',
              dataError
            );
          }
        }

        setConnectionStatus({
          truelayer: hasTrueLayer,
          monzo: hasMonzo,
        });
      } catch (error) {
        console.error('Failed to load connection status:', error);
        // If there are no sessions, set both to false
        setConnectionStatus({
          truelayer: false,
          monzo: false,
        });
      }
    };

    loadConnectionStatus();
  }, []);

  const handleConnectTrueLayer = () => {
    // Pass the current user ID as a query parameter
    const userId = currentUser?.uid || 'anonymous';
    console.log('🚀 Starting TrueLayer OAuth flow...');
    console.log('🔍 Current user:', currentUser);
    console.log('🔍 User ID being passed:', userId);
    console.log('🔗 Redirecting to:', `/api/auth/truelayer?userId=${userId}`);
    window.location.href = `/api/auth/truelayer?userId=${userId}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with back button */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center text-gray-300 hover:text-white mb-4 transition-colors"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </button>

          <h1 className="text-3xl font-bold text-white">Debug Page</h1>
          <p className="mt-2 text-gray-300">
            Debug information and system status
          </p>
        </div>

        {/* Debug Content */}
        <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            Authentication Status
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600">
              <span className="font-medium text-gray-200">User Status:</span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  currentUser
                    ? 'bg-green-800 text-green-200'
                    : 'bg-red-800 text-red-200'
                }`}
              >
                {currentUser ? 'Authenticated' : 'Not Authenticated'}
              </span>
            </div>

            {currentUser && (
              <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                <h3 className="font-medium text-gray-200 mb-2">
                  User Information:
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-300">UID:</span>{' '}
                    <span className="text-gray-100">{currentUser.uid}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-300">Email:</span>{' '}
                    <span className="text-gray-100">
                      {currentUser.email || 'No email'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-300">
                      Display Name:
                    </span>{' '}
                    <span className="text-gray-100">
                      {currentUser.displayName || 'No display name'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Environment Info */}
        <div className="mt-6 bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            Environment Information
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600">
              <span className="font-medium text-gray-200">Environment:</span>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-800 text-blue-200">
                {process.env.NODE_ENV || 'development'}
              </span>
            </div>

            <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
              <h3 className="font-medium text-gray-200 mb-2">
                Firebase Config:
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-300">Project ID:</span>{' '}
                  <span className="text-gray-100">
                    {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Not set'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-300">
                    Auth Domain:
                  </span>{' '}
                  <span className="text-gray-100">
                    {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'Not set'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-300">API Key:</span>{' '}
                  <span className="text-gray-100">
                    {process.env.NEXT_PUBLIC_FIREBASE_API_KEY
                      ? 'Set'
                      : 'Not set'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="mt-6 bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            System Status
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600">
              <span className="font-medium text-gray-200">Build Time:</span>
              <span className="text-sm text-gray-300">
                {new Date().toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600">
              <span className="font-medium text-gray-200">User Agent:</span>
              <span className="text-sm text-gray-300 max-w-md truncate">
                {typeof window !== 'undefined'
                  ? window.navigator.userAgent
                  : 'Server-side'}
              </span>
            </div>
          </div>
        </div>

        {/* Connection Status Section */}
        <div className="mt-6 bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            🔗 Connection Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* TrueLayer Connection */}
            <div className="bg-gray-700/50 rounded-lg p-6 border border-gray-600">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">TrueLayer</h3>
                <div
                  className={`px-3 py-1 rounded-full text-sm ${
                    connectionStatus.truelayer
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-600 text-gray-300'
                  }`}
                >
                  {connectionStatus.truelayer ? 'Connected' : 'Not Connected'}
                </div>
              </div>
              <p className="text-gray-300 text-sm mb-4">
                Connect your bank accounts to monitor credit card balances.
              </p>
              {!connectionStatus.truelayer ? (
                <button
                  onClick={handleConnectTrueLayer}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Connect TrueLayer
                </button>
              ) : (
                <div className="text-green-400 text-sm">
                  ✓ Successfully connected
                </div>
              )}
            </div>

            {/* Monzo Connection */}
            <div className="bg-gray-700/50 rounded-lg p-6 border border-gray-600">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Monzo</h3>
                <div
                  className={`px-3 py-1 rounded-full text-sm ${
                    connectionStatus.monzo
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-600 text-gray-300'
                  }`}
                >
                  {connectionStatus.monzo ? 'Connected' : 'Not Connected'}
                </div>
              </div>
              <p className="text-gray-300 text-sm mb-4">
                {connectionStatus.monzo
                  ? 'Monzo account connected via TrueLayer for pot transfers.'
                  : 'Connect your Monzo account to manage pot transfers.'}
              </p>
              {connectionStatus.monzo ? (
                <div className="text-green-400 text-sm">
                  ✓ Connected via TrueLayer
                </div>
              ) : (
                <button
                  disabled
                  className="w-full bg-gray-600 text-gray-400 px-4 py-2 rounded-md text-sm font-medium cursor-not-allowed"
                >
                  Coming Soon
                </button>
              )}
            </div>
          </div>
        </div>

        {/* OAuth Results Section */}
        {oauthResults && (
          <div className="mt-6 bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">
              🔍 OAuth Results
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Connected:</span>
                  <span
                    className={`font-medium ${oauthResults.connected === 'true' ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {oauthResults.connected || 'false'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Provider:</span>
                  <span className="text-white">
                    {oauthResults.provider || 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Access Token:</span>
                  <span
                    className={`font-medium ${oauthResults.hasAccessToken ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {oauthResults.hasAccessToken ? '✓ Present' : '✗ Missing'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Refresh Token:</span>
                  <span
                    className={`font-medium ${oauthResults.hasRefreshToken ? 'text-green-400' : 'text-yellow-400'}`}
                  >
                    {oauthResults.hasRefreshToken ? '✓ Present' : '⚠ Optional'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Expires In:</span>
                  <span className="text-white">
                    {oauthResults.expiresIn
                      ? `${oauthResults.expiresIn}s`
                      : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Expires At:</span>
                  <span className="text-white text-sm">
                    {oauthResults.expiresAt
                      ? new Date(
                          parseInt(oauthResults.expiresAt)
                        ).toLocaleString()
                      : 'Unknown'}
                  </span>
                </div>
                {oauthResults.error && (
                  <div className="flex justify-between">
                    <span className="text-gray-300">Error:</span>
                    <span className="text-red-400 text-sm">
                      {oauthResults.error}
                    </span>
                  </div>
                )}
                {oauthResults.errorMessage && (
                  <div className="flex justify-between">
                    <span className="text-gray-300">Error Message:</span>
                    <span className="text-red-400 text-sm">
                      {oauthResults.errorMessage}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={() => setOauthResults(null)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Clear Results
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
