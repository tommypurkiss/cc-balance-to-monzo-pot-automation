export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
  preferences?: UserPreferences;
  settings?: UserSettings;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    balanceAlerts: boolean;
  };
  language: string;
}

export interface UserSettings {
  timezone: string;
  currency: string;
  dateFormat: string;
  autoTransfer: {
    enabled: boolean;
    threshold: number;
    frequency: 'daily' | 'weekly' | 'monthly';
  };
}

export interface CreateUserData {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  preferences?: Partial<UserPreferences>;
  settings?: Partial<UserSettings>;
}

export interface UpdateUserData {
  displayName?: string;
  photoURL?: string;
  preferences?: UserPreferences;
  settings?: UserSettings;
}

export interface UserServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Specific response types for better type safety
export type UserProfileResponse = UserServiceResponse<UserProfile>;
export type UserListResponse = UserServiceResponse<UserProfile[]>;
export type UserExistsResponse = UserServiceResponse<boolean>;
export type UserDeleteResponse = UserServiceResponse<void>;
