'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">500</h1>
        <h2 className="text-2xl font-semibold text-gray-300 mb-6">
          Something went wrong!
        </h2>
        <p className="text-gray-400 mb-8">
          An unexpected error occurred. Please try again.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
