'use client';

import { useEffect, useState } from 'react';
import TrueLayerDashboard from './TrueLayerDashboard';

export default function Dashboard() {
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

  return (
    <div className="min-h-screen bg-gray-900">
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
