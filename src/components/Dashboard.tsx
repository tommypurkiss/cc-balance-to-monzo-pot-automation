'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import Link from 'next/link';
import TrueLayerDashboard from './TrueLayerDashboard';

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const { userProfile } = useUser();
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

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

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Mobile-optimized header */}
      <nav className="bg-gray-800 shadow-lg border-b border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-lg sm:text-xl font-semibold text-white">
                Balance to Monzo Pot
              </h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="hidden sm:inline text-sm text-gray-300">
                Welcome,{' '}
                {userProfile?.displayName ||
                  currentUser?.displayName ||
                  currentUser?.email}
              </span>
              {process.env.NODE_ENV !== 'production' && (
                <Link
                  href="/debug"
                  className="bg-gray-600 hover:bg-gray-700 text-white px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors"
                >
                  Debug
                </Link>
              )}
              <Link
                href="/profile"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors"
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="px-4 py-4 sm:px-6 lg:px-8">
        {/* Notification */}
        {notification && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              notification.type === 'success'
                ? 'bg-green-800/50 border border-green-600 text-green-200'
                : 'bg-red-800/50 border border-red-600 text-red-200'
            }`}
          >
            {notification.message}
          </div>
        )}

        <TrueLayerDashboard />
      </main>
    </div>
  );
}
