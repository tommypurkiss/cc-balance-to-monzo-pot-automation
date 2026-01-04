'use client';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { BankingDataProvider } from '@/contexts/BankingDataContext';
import Navbar from '../Navbar/Navbar';

interface AppProvidersProps {
  children: React.ReactNode;
}

function UserAndBankingProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser } = useAuth();

  return (
    <UserProvider currentUser={currentUser}>
      <BankingDataProvider currentUser={currentUser}>
        {currentUser && <Navbar />}
        {children}
      </BankingDataProvider>
    </UserProvider>
  );
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <UserAndBankingProviderWrapper>{children}</UserAndBankingProviderWrapper>
    </AuthProvider>
  );
}
