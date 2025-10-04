'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import Link from 'next/link';

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const { userProfile } = useUser();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out:', error);
    }
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
          <div className="border-4 border-dashed border-gray-600 rounded-lg h-96 flex items-center justify-center bg-gray-800/50">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Dashboard</h2>
              <p className="text-gray-300 mb-6">
                Your authentication is working! This is where your app content
                will go.
              </p>
              {userProfile && (
                <div className="bg-gray-800/50 rounded-lg p-4 max-w-md mx-auto">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    User Profile
                  </h3>
                  <p className="text-gray-300 text-sm">
                    <strong>Email:</strong> {userProfile.email}
                  </p>
                  {userProfile.displayName && (
                    <p className="text-gray-300 text-sm">
                      <strong>Name:</strong> {userProfile.displayName}
                    </p>
                  )}
                  <p className="text-gray-300 text-sm">
                    <strong>Theme:</strong>{' '}
                    {userProfile.preferences?.theme || 'dark'}
                  </p>
                  <p className="text-gray-300 text-sm">
                    <strong>Currency:</strong>{' '}
                    {userProfile.settings?.currency || 'GBP'}
                  </p>
                  <Link
                    href="/profile"
                    className="inline-block mt-3 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Manage Profile
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
