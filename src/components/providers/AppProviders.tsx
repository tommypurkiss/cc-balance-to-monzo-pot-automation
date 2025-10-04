'use client';

import React from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

function UserProviderWrapper({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();

  return <UserProvider currentUser={currentUser}>{children}</UserProvider>;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <UserProviderWrapper>{children}</UserProviderWrapper>
    </AuthProvider>
  );
}
