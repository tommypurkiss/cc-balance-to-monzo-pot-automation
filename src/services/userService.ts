import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  UserProfile,
  CreateUserData,
  UpdateUserData,
  UserProfileResponse,
  UserListResponse,
  UserExistsResponse,
  UserDeleteResponse,
  UserPreferences,
  UserSettings,
} from '@/types/user';

// Interface for Firestore document data
interface FirestoreUserData {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt?: { toDate: () => Date };
  updatedAt?: { toDate: () => Date };
  deleted?: boolean;
  preferences?: UserPreferences;
  settings?: UserSettings;
}

const USERS_COLLECTION = 'users';

// Default user preferences
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  notifications: {
    email: true,
    push: true,
    balanceAlerts: true,
  },
  language: 'en',
};

// Default user settings
const DEFAULT_SETTINGS: UserSettings = {
  timezone: 'UTC',
  currency: 'GBP',
  dateFormat: 'DD/MM/YYYY',
  autoTransfer: {
    enabled: false,
    threshold: 0,
    frequency: 'daily',
  },
};

export class UserService {
  /**
   * Create a new user profile in Firestore
   */
  static async createUser(
    userData: CreateUserData
  ): Promise<UserProfileResponse> {
    try {
      const userRef = doc(db, USERS_COLLECTION, userData.uid);

      const newUser: UserProfile = {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName || '',
        photoURL: userData.photoURL || '',
        createdAt: new Date(),
        updatedAt: new Date(),
        preferences: { ...DEFAULT_PREFERENCES, ...userData.preferences },
        settings: { ...DEFAULT_SETTINGS, ...userData.settings },
      };

      await setDoc(userRef, {
        ...newUser,
        deleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        data: newUser,
      };
    } catch (error) {
      console.error('Error creating user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user',
      };
    }
  }

  /**
   * Get a user profile by UID
   */
  static async getUser(uid: string): Promise<UserProfileResponse> {
    try {
      const userRef = doc(db, USERS_COLLECTION, uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      const userData = userSnap.data() as FirestoreUserData;

      // Check if user is soft deleted
      if (userData.deleted === true) {
        return {
          success: false,
          error: 'User not found',
        };
      }
      const user: UserProfile = {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName || '',
        photoURL: userData.photoURL || '',
        createdAt: userData.createdAt?.toDate() || new Date(),
        updatedAt: userData.updatedAt?.toDate() || new Date(),
        preferences: userData.preferences || DEFAULT_PREFERENCES,
        settings: userData.settings || DEFAULT_SETTINGS,
      };

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      console.error('Error getting user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user',
      };
    }
  }

  /**
   * Update a user profile
   */
  static async updateUser(
    uid: string,
    updateData: UpdateUserData
  ): Promise<UserProfileResponse> {
    try {
      const userRef = doc(db, USERS_COLLECTION, uid);

      // First get the current user data
      const currentUserResponse = await this.getUser(uid);
      if (!currentUserResponse.success || !currentUserResponse.data) {
        return currentUserResponse;
      }

      const currentUser = currentUserResponse.data;

      // Merge preferences and settings if provided
      const updatedPreferences = {
        ...currentUser.preferences,
        ...(updateData.preferences || {}),
      } as UserPreferences;

      const updatedSettings = {
        ...currentUser.settings,
        ...(updateData.settings || {}),
      } as UserSettings;

      const updatePayload = {
        ...updateData,
        preferences: updatedPreferences,
        settings: updatedSettings,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(userRef, updatePayload);

      // Return updated user data
      const updatedUser: UserProfile = {
        ...currentUser,
        ...updateData,
        preferences: updatedPreferences,
        settings: updatedSettings,
        updatedAt: new Date(),
      };

      return {
        success: true,
        data: updatedUser,
      };
    } catch (error) {
      console.error('Error updating user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user',
      };
    }
  }

  /**
   * Delete a user profile (soft delete by setting deleted: true)
   */
  static async deleteUser(uid: string): Promise<UserDeleteResponse> {
    try {
      const userRef = doc(db, USERS_COLLECTION, uid);

      // Instead of actually deleting, we'll mark as deleted
      await updateDoc(userRef, {
        deleted: true,
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error deleting user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete user',
      };
    }
  }

  /**
   * Restore a soft-deleted user profile
   */
  static async restoreUser(uid: string): Promise<UserDeleteResponse> {
    try {
      const userRef = doc(db, USERS_COLLECTION, uid);

      await updateDoc(userRef, {
        deleted: false,
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error restoring user:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to restore user',
      };
    }
  }

  /**
   * Permanently delete a user profile (use with caution)
   */
  static async permanentlyDeleteUser(uid: string): Promise<UserDeleteResponse> {
    try {
      const userRef = doc(db, USERS_COLLECTION, uid);
      await deleteDoc(userRef);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error permanently deleting user:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to permanently delete user',
      };
    }
  }

  /**
   * Get all active users (admin function)
   */
  static async getAllUsers(): Promise<UserListResponse> {
    try {
      const usersRef = collection(db, USERS_COLLECTION);
      const q = query(
        usersRef,
        where('deleted', '==', false),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const users: UserProfile[] = [];

      querySnapshot.forEach((doc) => {
        const userData = doc.data() as FirestoreUserData;
        users.push({
          uid: userData.uid,
          email: userData.email,
          displayName: userData.displayName || '',
          photoURL: userData.photoURL || '',
          createdAt: userData.createdAt?.toDate() || new Date(),
          updatedAt: userData.updatedAt?.toDate() || new Date(),
          preferences: userData.preferences || DEFAULT_PREFERENCES,
          settings: userData.settings || DEFAULT_SETTINGS,
        });
      });

      return {
        success: true,
        data: users,
      };
    } catch (error) {
      console.error('Error getting all users:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get users',
      };
    }
  }

  /**
   * Check if a user exists
   */
  static async userExists(uid: string): Promise<UserExistsResponse> {
    try {
      const userRef = doc(db, USERS_COLLECTION, uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        return {
          success: true,
          data: false,
        };
      }

      const userData = userSnap.data() as FirestoreUserData;

      // User exists if document exists and is not soft deleted
      const exists = userData.deleted !== true;

      return {
        success: true,
        data: exists,
      };
    } catch (error) {
      console.error('Error checking if user exists:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check user existence',
      };
    }
  }

  /**
   * Update user preferences only
   */
  static async updatePreferences(
    uid: string,
    preferences: UserPreferences
  ): Promise<UserProfileResponse> {
    return this.updateUser(uid, { preferences });
  }

  /**
   * Update user settings only
   */
  static async updateSettings(
    uid: string,
    settings: UserSettings
  ): Promise<UserProfileResponse> {
    return this.updateUser(uid, { settings });
  }

  /**
   * Get all soft-deleted users (admin function)
   */
  static async getDeletedUsers(): Promise<UserListResponse> {
    try {
      const usersRef = collection(db, USERS_COLLECTION);
      const q = query(
        usersRef,
        where('deleted', '==', true),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const users: UserProfile[] = [];

      querySnapshot.forEach((doc) => {
        const userData = doc.data() as FirestoreUserData;
        users.push({
          uid: userData.uid,
          email: userData.email,
          displayName: userData.displayName || '',
          photoURL: userData.photoURL || '',
          createdAt: userData.createdAt?.toDate() || new Date(),
          updatedAt: userData.updatedAt?.toDate() || new Date(),
          preferences: userData.preferences || DEFAULT_PREFERENCES,
          settings: userData.settings || DEFAULT_SETTINGS,
        });
      });

      return {
        success: true,
        data: users,
      };
    } catch (error) {
      console.error('Error getting deleted users:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get deleted users',
      };
    }
  }
}
