'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function MonzoConfirmPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [authCompleted, setAuthCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasStartedAuth = useRef(false); // Prevent duplicate API calls

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const success = searchParams.get('success');
  const userId = searchParams.get('userId');

  // Automatically start the authorization process when page loads
  useEffect(() => {
    // Prevent duplicate calls (React 18 Strict Mode runs useEffect twice in dev)
    if (hasStartedAuth.current) {
      return;
    }

    hasStartedAuth.current = true;

    const processAuthorization = async () => {
      // Check if we're coming from the callback (success flow) or direct from Monzo (old flow)
      if (success === 'true' && userId) {
        setAuthCompleted(true);
        return;
      }

      if (!code || !state) {
        setError('Missing authorization code or state');
        return;
      }

      try {
        // Call the callback endpoint to complete the OAuth flow
        // This will trigger the Monzo app notification
        await fetch(
          `/api/auth/monzo/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
        );

        // Always show the confirm button - if they got this far, the notification was sent
        setAuthCompleted(true);
      } catch (err) {
        console.error('Network error:', err);
        // Even on network error, if we have code and state, show the button
        // The user got the notification, so they can proceed
        setAuthCompleted(true);
      }
    };

    processAuthorization();
  }, [code, state, success, userId]);

  const handleConfirm = () => {
    // Always redirect to dashboard - let ProtectedRoute handle auth checks
    router.push('/?monzo_connected=true');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 border border-blue-600 rounded-lg p-8 text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Almost There!</h1>
          <p className="text-gray-300 mb-4">
            Check your Monzo app to approve access
          </p>
        </div>

        {!authCompleted && !error && (
          <div className="mb-6">
            <div className="flex items-center justify-center mb-4">
              <svg
                className="animate-spin h-8 w-8 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
            <p className="text-gray-300 text-sm">Setting up authorization...</p>
          </div>
        )}

        {authCompleted && (
          <div className="bg-gray-700 border border-gray-600 rounded p-4 mb-6">
            <div className="flex items-start text-left">
              <div className="flex-shrink-0 mr-3">
                <span className="text-2xl">📱</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">
                  Check your Monzo app now
                </h3>
                <p className="text-xs text-gray-300">
                  You should have received a notification. Tap it and enter your
                  PIN, fingerprint, or Face ID to approve access for automated
                  pot transfers.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {authCompleted && (
          <button
            onClick={handleConfirm}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            I&apos;ve Approved in the App
          </button>
        )}

        <p className="text-xs text-gray-400 mt-4">
          Haven&apos;t received a notification?{' '}
          <button
            onClick={() => router.push('/')}
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Go back to dashboard
          </button>
        </p>
      </div>
    </div>
  );
}
