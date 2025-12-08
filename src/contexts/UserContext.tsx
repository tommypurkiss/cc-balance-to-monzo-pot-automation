'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { User } from 'firebase/auth';
import { UserService } from '@/services/userService';
import { UserProfile, UpdateUserData } from '@/types/user';

interface UserContextType {
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (data: UpdateUserData) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  deleteProfile: () => Promise<boolean>;
}

const UserContext = createContext<UserContextType>({} as UserContextType);

export function useUser() {
  return useContext(UserContext);
}

interface UserProviderProps {
  children: React.ReactNode;
  currentUser: User | null;
}

export function UserProvider({ children, currentUser }: UserProviderProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUserProfile = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    setError(null);

    try {
      // First check if user profile exists
      const existsResponse = await UserService.userExists(currentUser.uid);

      if (!existsResponse.success) {
        throw new Error(
          existsResponse.error || 'Failed to check user existence'
        );
      }

      if (!existsResponse.data) {
        // User profile doesn't exist, create it
        const createResponse = await UserService.createUser({
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || '',
          photoURL: currentUser.photoURL || '',
        });

        if (!createResponse.success) {
          throw new Error(
            createResponse.error || 'Failed to create user profile'
          );
        }

        setUserProfile(createResponse.data!);
      } else {
        // User profile exists, fetch it
        const getResponse = await UserService.getUser(currentUser.uid);

        if (!getResponse.success) {
          throw new Error(getResponse.error || 'Failed to get user profile');
        }

        setUserProfile(getResponse.data!);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load user profile';
      setError(errorMessage);
      console.error('Error loading user profile:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Load user profile when currentUser changes
  useEffect(() => {
    if (currentUser) {
      loadUserProfile();
    } else {
      setUserProfile(null);
      setError(null);
    }
  }, [currentUser, loadUserProfile]);

  const updateProfile = useCallback(
    async (data: UpdateUserData): Promise<boolean> => {
      if (!currentUser || !userProfile) return false;

      setLoading(true);
      setError(null);

      try {
        const response = await UserService.updateUser(currentUser.uid, data);

        if (!response.success) {
          throw new Error(response.error || 'Failed to update profile');
        }

        setUserProfile(response.data!);
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to update profile';
        setError(errorMessage);
        console.error('Error updating profile:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [currentUser, userProfile]
  );

  const refreshProfile = useCallback(async (): Promise<void> => {
    if (!currentUser) return;
    await loadUserProfile();
  }, [currentUser, loadUserProfile]);

  const deleteProfile = useCallback(async (): Promise<boolean> => {
    if (!currentUser || !userProfile) return false;

    setLoading(true);
    setError(null);

    try {
      const response = await UserService.deleteUser(currentUser.uid);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete profile');
      }

      setUserProfile(null);
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete profile';
      setError(errorMessage);
      console.error('Error deleting profile:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile]);

  const value: UserContextType = {
    userProfile,
    loading,
    error,
    updateProfile,
    refreshProfile,
    deleteProfile,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
