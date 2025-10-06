'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function OAuthCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentUser, loading } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>(
    'processing'
  );
  const [message, setMessage] = useState('Processing OAuth callback...');

  useEffect(() => {
    const processCallback = async () => {
      // Wait for auth to be ready
      if (loading) return;

      const truelayerSuccess = searchParams.get('truelayer_success');
      const truelayerError = searchParams.get('truelayer_error');
      const errorMessage = searchParams.get('error_message');
      const provider = searchParams.get('provider');

      if (truelayerError) {
        setStatus('error');
        setMessage(errorMessage || 'OAuth callback failed');
        setTimeout(() => {
          router.push('/signin');
        }, 3000);
        return;
      }

      if (truelayerSuccess) {
        setStatus('success');
        setMessage(`Successfully connected ${provider || 'bank account'}!`);

        // If user is authenticated, redirect to dashboard
        if (currentUser) {
          setTimeout(() => {
            router.push('/');
          }, 2000);
        } else {
          // If user is not authenticated, redirect to signin
          setTimeout(() => {
            router.push('/signin');
          }, 2000);
        }
        return;
      }

      // No OAuth parameters, redirect to signin
      router.push('/signin');
    };

    processCallback();
  }, [searchParams, router, currentUser, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full bg-gray-800 rounded-lg p-8 text-center">
        <div className="mb-6">
          {status === 'processing' && (
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          )}
          {status === 'success' && (
            <div className="rounded-full h-16 w-16 bg-green-600 flex items-center justify-center mx-auto">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
          {status === 'error' && (
            <div className="rounded-full h-16 w-16 bg-red-600 flex items-center justify-center mx-auto">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          )}
        </div>

        <h2 className="text-xl font-semibold text-white mb-4">
          {status === 'processing' && 'Processing...'}
          {status === 'success' && 'Success!'}
          {status === 'error' && 'Error'}
        </h2>

        <p className="text-gray-300 mb-6">{message}</p>

        {status === 'success' && !currentUser && (
          <p className="text-sm text-gray-400 mb-4">
            Redirecting to sign in page...
          </p>
        )}

        {status === 'success' && currentUser && (
          <p className="text-sm text-gray-400 mb-4">
            Redirecting to dashboard...
          </p>
        )}

        {status === 'error' && (
          <p className="text-sm text-gray-400 mb-4">
            Redirecting to sign in page...
          </p>
        )}
      </div>
    </div>
  );
}
