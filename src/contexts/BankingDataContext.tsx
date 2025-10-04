'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { User } from 'firebase/auth';
import {
  clientStorage,
  CardData,
  CardBalance,
  AccountData,
  AccountBalance,
} from '@/lib/clientStorage';

export interface ProviderData {
  cards: (CardData & { balance?: CardBalance })[];
  accounts: (AccountData & { balance?: AccountBalance })[];
}

export interface BankingData {
  [provider: string]: ProviderData;
}

interface BankingDataContextType {
  data: BankingData;
  loading: boolean;
  error: string | null;
  loadData: (forceRefresh?: boolean) => Promise<void>;
  removeProvider: (provider: string) => void;
  isInitialized: boolean;
}

const BankingDataContext = createContext<BankingDataContextType>(
  {} as BankingDataContextType
);

export function useBankingData() {
  return useContext(BankingDataContext);
}

interface BankingDataProviderProps {
  children: React.ReactNode;
  currentUser: User | null;
}

export function BankingDataProvider({
  children,
  currentUser,
}: BankingDataProviderProps) {
  const [data, setData] = useState<BankingData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const loadData = useCallback(
    async (forceRefresh = false) => {
      if (!currentUser) {
        setData({});
        setIsInitialized(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Set the authenticated user ID in clientStorage
        clientStorage.setUserId(currentUser.uid);

        // Initialize sessions and load all data
        await clientStorage.initializeSessions();
        const allData = forceRefresh
          ? await clientStorage.refreshData()
          : await clientStorage.getAllData();

        setData(allData);
        setIsInitialized(true);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';

        // Check if it's an authentication error
        if (
          errorMessage.includes('invalid_token') ||
          errorMessage.includes('401') ||
          errorMessage.includes('unauthorized')
        ) {
          setError(
            'Your bank connections have expired. Please reconnect your accounts to continue.'
          );
          // Clear old data when authentication fails
          setData({});
        } else {
          setError('Failed to load data: ' + errorMessage);
        }
        setIsInitialized(true);
      } finally {
        setLoading(false);
      }
    },
    [currentUser]
  );

  const removeProvider = useCallback((provider: string) => {
    setData((prev) => {
      const newData = { ...prev };
      delete newData[provider];
      return newData;
    });
  }, []);

  // Load data when currentUser changes (but only if not already initialized)
  useEffect(() => {
    if (currentUser && !isInitialized) {
      loadData();
    } else if (!currentUser) {
      setData({});
      setError(null);
      setIsInitialized(false);
    }
  }, [currentUser, isInitialized, loadData]);

  const value: BankingDataContextType = {
    data,
    loading,
    error,
    loadData,
    removeProvider,
    isInitialized,
  };

  return (
    <BankingDataContext.Provider value={value}>
      {children}
    </BankingDataContext.Provider>
  );
}
