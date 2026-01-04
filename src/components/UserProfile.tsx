'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { UpdateUserData } from '@/types/user';
import { clientStorage } from '@/lib/clientStorage';
import { getProviderDisplayName } from '@/shared-utils/getProviderNames';

export default function UserProfile() {
  const { userProfile, loading, error, updateProfile } = useUser();
  const { logout } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);

  // Load connected providers
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const data = await clientStorage.getAllData();
        const providerList = Object.keys(data);
        setProviders(providerList);
      } catch (error) {
        console.error('Failed to load providers:', error);
      }
    };

    loadProviders();
  }, []);

  const handleLogout = async (provider: string) => {
    await clientStorage.removeSession(provider);
    setProviders((prev) => prev.filter((p) => p !== provider));
  };

  const handleDisconnect = async (provider: string) => {
    await clientStorage.deleteTokens(provider);
    setProviders((prev) => prev.filter((p) => p !== provider));
  };

  const [formData, setFormData] = useState({
    displayName: userProfile?.displayName || '',
    preferences: {
      theme: userProfile?.preferences?.theme || 'dark',
      notifications: {
        email: userProfile?.preferences?.notifications?.email ?? true,
        push: userProfile?.preferences?.notifications?.push ?? true,
        balanceAlerts:
          userProfile?.preferences?.notifications?.balanceAlerts ?? true,
      },
      language: userProfile?.preferences?.language || 'en',
    },
    settings: {
      timezone: userProfile?.settings?.timezone || 'UTC',
      currency: userProfile?.settings?.currency || 'GBP',
      dateFormat: userProfile?.settings?.dateFormat || 'DD/MM/YYYY',
      autoTransfer: {
        enabled: userProfile?.settings?.autoTransfer?.enabled ?? false,
        threshold: userProfile?.settings?.autoTransfer?.threshold || 0,
        frequency: userProfile?.settings?.autoTransfer?.frequency || 'daily',
      },
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNestedInputChange = (
    parent: string,
    field: string,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [parent]: {
        ...(prev[parent as keyof typeof prev] as Record<string, unknown>),
        [field]: value,
      },
    }));
  };

  const handleDeepNestedInputChange = (
    parent: string,
    child: string,
    field: string,
    value: string | number | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [parent]: {
        ...(prev[parent as keyof typeof prev] as Record<string, unknown>),
        [child]: {
          ...((prev[parent as keyof typeof prev] as Record<string, unknown>)[
            child
          ] as Record<string, unknown>),
          [field]: value,
        },
      },
    }));
  };

  const handleSave = async () => {
    const updateData: UpdateUserData = {
      displayName: formData.displayName,
      preferences: formData.preferences,
      settings: formData.settings,
    };

    const success = await updateProfile(updateData);
    if (success) {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      displayName: userProfile?.displayName || '',
      preferences: {
        theme: userProfile?.preferences?.theme || 'dark',
        notifications: {
          email: userProfile?.preferences?.notifications?.email ?? true,
          push: userProfile?.preferences?.notifications?.push ?? true,
          balanceAlerts:
            userProfile?.preferences?.notifications?.balanceAlerts ?? true,
        },
        language: userProfile?.preferences?.language || 'en',
      },
      settings: {
        timezone: userProfile?.settings?.timezone || 'UTC',
        currency: userProfile?.settings?.currency || 'GBP',
        dateFormat: userProfile?.settings?.dateFormat || 'DD/MM/YYYY',
        autoTransfer: {
          enabled: userProfile?.settings?.autoTransfer?.enabled ?? false,
          threshold: userProfile?.settings?.autoTransfer?.threshold || 0,
          frequency: userProfile?.settings?.autoTransfer?.frequency || 'daily',
        },
      },
    });
    setIsEditing(false);
  };

  if (loading && !userProfile) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
        <p className="text-red-300">Error: {error}</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4">
        <p className="text-yellow-300">No user profile found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back Button */}
      <div className="mb-4">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-300 hover:text-white transition-colors"
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
          Back
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">User Profile</h2>
            <div className="flex space-x-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={userProfile.email}
                  disabled
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-300 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) =>
                    handleInputChange('displayName', e.target.value)
                  }
                  disabled={!isEditing}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Preferences
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Theme
                </label>
                <select
                  value={formData.preferences.theme}
                  onChange={(e) =>
                    handleNestedInputChange(
                      'preferences',
                      'theme',
                      e.target.value
                    )
                  }
                  disabled={!isEditing}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Language
                </label>
                <select
                  value={formData.preferences.language}
                  onChange={(e) =>
                    handleNestedInputChange(
                      'preferences',
                      'language',
                      e.target.value
                    )
                  }
                  disabled={!isEditing}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>
            </div>

            {/* Notifications */}
            <div className="mt-4">
              <h4 className="text-md font-medium text-white mb-3">
                Notifications
              </h4>
              <div className="space-y-2">
                {Object.entries(formData.preferences.notifications).map(
                  ([key, value]) => (
                    <label key={key} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) =>
                          handleDeepNestedInputChange(
                            'preferences',
                            'notifications',
                            key,
                            e.target.checked
                          )
                        }
                        disabled={!isEditing}
                        className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-600 rounded bg-gray-800 disabled:opacity-50"
                      />
                      <span className="text-gray-300 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </label>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Settings */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Timezone
                </label>
                <select
                  value={formData.settings.timezone}
                  onChange={(e) =>
                    handleNestedInputChange(
                      'settings',
                      'timezone',
                      e.target.value
                    )
                  }
                  disabled={!isEditing}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">London</option>
                  <option value="America/New_York">New York</option>
                  <option value="America/Los_Angeles">Los Angeles</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Currency
                </label>
                <select
                  value={formData.settings.currency}
                  onChange={(e) =>
                    handleNestedInputChange(
                      'settings',
                      'currency',
                      e.target.value
                    )
                  }
                  disabled={!isEditing}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>

            {/* Auto Transfer Settings */}
            <div className="mt-4">
              <h4 className="text-md font-medium text-white mb-3">
                Auto Transfer Settings
              </h4>
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.settings.autoTransfer.enabled}
                    onChange={(e) =>
                      handleDeepNestedInputChange(
                        'settings',
                        'autoTransfer',
                        'enabled',
                        e.target.checked
                      )
                    }
                    disabled={!isEditing}
                    className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-600 rounded bg-gray-800 disabled:opacity-50"
                  />
                  <span className="text-gray-300">Enable Auto Transfer</span>
                </label>

                {formData.settings.autoTransfer.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-7">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Threshold (£)
                      </label>
                      <input
                        type="number"
                        value={formData.settings.autoTransfer.threshold}
                        onChange={(e) =>
                          handleDeepNestedInputChange(
                            'settings',
                            'autoTransfer',
                            'threshold',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        disabled={!isEditing}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Frequency
                      </label>
                      <select
                        value={formData.settings.autoTransfer.frequency}
                        onChange={(e) =>
                          handleDeepNestedInputChange(
                            'settings',
                            'autoTransfer',
                            'frequency',
                            e.target.value
                          )
                        }
                        disabled={!isEditing}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Connected Providers */}
          <div className="pt-6 border-t border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              🔧 Connected Providers
            </h3>
            {providers.length > 0 ? (
              <div className="space-y-2">
                {providers.map((provider) => (
                  <div
                    key={provider}
                    className="flex items-center justify-between bg-gray-700 p-3 rounded-lg"
                  >
                    <span className="text-white">
                      {getProviderDisplayName(provider)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleLogout(provider)}
                        className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600 font-medium"
                        title="Clear session (tokens remain saved)"
                      >
                        Logout
                      </button>
                      <button
                        onClick={() => handleDisconnect(provider)}
                        className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 font-medium"
                        title="Permanently disconnect account"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400 text-center py-4">
                No connected providers
              </div>
            )}
          </div>

          {/* Account Actions */}
          <div className="pt-6 border-t border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              Account Actions
            </h3>
            <div className="flex space-x-4">
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
