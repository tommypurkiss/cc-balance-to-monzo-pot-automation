'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import TrueLayerDashboard from './TrueLayerDashboard';
import { clientStorage } from '@/lib/clientStorage';

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const { userProfile } = useUser();
  const searchParams = useSearchParams();
  const [connectionStatus, setConnectionStatus] = useState<{
    truelayer: boolean;
    monzo: boolean;
  }>({ truelayer: false, monzo: false });
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
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

    console.log('🔍 OAuth Callback Results:', results);

    // Store results for display on dashboard
    setOauthResults(results);

    if (truelayerSuccess === 'true' && provider) {
      console.log('✅ TrueLayer connection successful!');
      console.log('🏦 Provider:', provider);
      console.log(
        '🔑 Access Token:',
        accessToken ? accessToken.substring(0, 20) + '...' : 'None'
      );
      console.log(
        '🔄 Refresh Token:',
        refreshToken ? refreshToken.substring(0, 20) + '...' : 'None'
      );
      console.log('⏰ Expires In:', expiresIn, 'seconds');
      console.log(
        '⏰ Expires At:',
        expiresAt ? new Date(parseInt(expiresAt)).toISOString() : 'None'
      );

      // Store tokens using client storage service
      if (accessToken) {
        const session = {
          provider,
          accessToken,
          refreshToken: refreshToken || undefined,
          expiresAt: expiresAt ? parseInt(expiresAt) : undefined,
          createdAt: Date.now(),
          userId: currentUser?.uid || 'anonymous',
        };

        clientStorage
          .addSession(session)
          .then(() => {
            console.log(`✅ ${provider} tokens stored via client storage`);
          })
          .catch((error) => {
            console.error('Failed to store tokens:', error);
          });
      }

      setConnectionStatus((prev) => ({ ...prev, truelayer: true }));
      setNotification({
        type: 'success',
        message: `Successfully connected to ${provider}!`,
      });
    } else if (truelayerError === 'true') {
      console.log('❌ TrueLayer connection failed:', errorMessage);
      setNotification({
        type: 'error',
        message: `Connection failed: ${errorMessage}`,
      });
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
  }, [searchParams, currentUser?.uid]);

  // Separate useEffect for clearing notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [notification]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

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
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-white">
                CC Balance to Monzo Pot
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-300">
                Welcome,{' '}
                {userProfile?.displayName ||
                  currentUser?.displayName ||
                  currentUser?.email}
              </span>
              <Link
                href="/profile"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Notification */}
          {notification && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                notification.type === 'success'
                  ? 'bg-green-800/50 border border-green-600 text-green-200'
                  : 'bg-red-800/50 border border-red-600 text-red-200'
              }`}
            >
              {notification.message}
            </div>
          )}

          <div className="border-4 border-dashed border-gray-600 rounded-lg p-8 bg-gray-800/50">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Dashboard</h2>
              <p className="text-gray-300 mb-6">
                Connect your accounts to start automating your credit card
                balance transfers.
              </p>
            </div>

            {/* Connection Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* TrueLayer Connection */}
              <div className="bg-gray-700/50 rounded-lg p-6 border border-gray-600">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    TrueLayer
                  </h3>
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
                  Connect your Monzo account to manage pot transfers.
                </p>
                <button
                  disabled
                  className="w-full bg-gray-600 text-gray-400 px-4 py-2 rounded-md text-sm font-medium cursor-not-allowed"
                >
                  Coming Soon
                </button>
              </div>
            </div>

            {/* OAuth Results Section */}
            {oauthResults && (
              <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-600 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">
                  🔍 OAuth Results
                </h3>
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
                        {oauthResults.hasAccessToken
                          ? '✓ Present'
                          : '✗ Missing'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Refresh Token:</span>
                      <span
                        className={`font-medium ${oauthResults.hasRefreshToken ? 'text-green-400' : 'text-yellow-400'}`}
                      >
                        {oauthResults.hasRefreshToken
                          ? '✓ Present'
                          : '⚠ Optional'}
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

            {/* User Profile Section */}
            {userProfile && (
              <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-600">
                <h3 className="text-lg font-semibold text-white mb-4">
                  User Profile
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-300">
                      <strong>Email:</strong> {userProfile.email}
                    </p>
                    {userProfile.displayName && (
                      <p className="text-gray-300">
                        <strong>Name:</strong> {userProfile.displayName}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-300">
                      <strong>Theme:</strong>{' '}
                      {userProfile.preferences?.theme || 'dark'}
                    </p>
                    <p className="text-gray-300">
                      <strong>Currency:</strong>{' '}
                      {userProfile.settings?.currency || 'GBP'}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <Link
                    href="/profile"
                    className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Manage Profile
                  </Link>
                </div>
              </div>
            )}

            {/* TrueLayer Dashboard */}
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-600">
              <h3 className="text-lg font-semibold text-white mb-4">
                Bank Accounts & Credit Cards
              </h3>
              <TrueLayerDashboard />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
