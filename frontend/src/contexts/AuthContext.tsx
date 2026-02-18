import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api, { User } from '../services/api';
import { getScopedStorageItem, removeScopedStorageItem, setScopedStorageItem } from '../utils/authStorage';

// Re-export types for backwards compatibility
export type UserRole = 'hirer' | 'caregiver' | 'admin';
export type AccountType = 'guest' | 'member';
export type TrustLevel = 'L0' | 'L1' | 'L2' | 'L3';
export type UserStatus = 'active' | 'suspended' | 'deleted';

export type { User };

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  activeRole: UserRole | null;
  login: (email: string, password: string) => Promise<User>;
  loginWithTokens: (accessToken: string, refreshToken?: string) => Promise<User>;
  loginWithPhone: (phone: string, password: string) => Promise<User>;
  registerGuest: (email: string, password: string, role: UserRole) => Promise<void>;
  registerMember: (phone: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
  setActiveRole: (role: UserRole | null) => void;
  updateUser: (updates: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);

  // Check for stored user and validate token on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedUser = getScopedStorageItem('careconnect_user');
      const token = getScopedStorageItem('careconnect_token');

      if (storedUser && token) {
        try {
          // Validate token by fetching current user
          const response = await api.getCurrentUser();
          if (response.success && response.data) {
            setUser(response.data.user);
            setScopedStorageItem('careconnect_user', JSON.stringify(response.data.user));
            const storedActiveRole = getScopedStorageItem('careconnect_active_role') as UserRole | null;
            const isStoredRoleValid = storedActiveRole === 'hirer' || storedActiveRole === 'caregiver';
            const isGuest = response.data.user.account_type === 'guest';
            if (isStoredRoleValid && (!isGuest || storedActiveRole === 'hirer')) {
              setActiveRole(storedActiveRole);
            } else {
              setActiveRole(null);
              removeScopedStorageItem('careconnect_active_role');
            }
          } else {
            // Token invalid, clear stored data
            api.clearTokens();
            setUser(null);
            setActiveRole(null);
          }
        } catch (error) {
          console.error('Failed to validate auth token:', error);
          api.clearTokens();
          setUser(null);
          setActiveRole(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Save user to scoped storage whenever it changes
  useEffect(() => {
    if (user) {
      setScopedStorageItem('careconnect_user', JSON.stringify(user));
    }
  }, [user]);

  useEffect(() => {
    if (activeRole) {
      setScopedStorageItem('careconnect_active_role', activeRole);
    } else {
      removeScopedStorageItem('careconnect_active_role');
    }
  }, [activeRole]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.loginWithEmail(email, password);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Login failed');
      }

      setUser(response.data.user);
      removeScopedStorageItem('pendingRole');
      removeScopedStorageItem('pendingAccountType');
      setActiveRole(null);
      return response.data.user;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithTokens = async (accessToken: string, refreshToken?: string) => {
    setIsLoading(true);
    try {
      api.clearTokens();
      api.setSessionTokens(accessToken, refreshToken);

      const response = await api.getCurrentUser();
      if (!response.success || !response.data?.user) {
        api.clearTokens();
        throw new Error(response.error || 'OAuth login failed');
      }

      setUser(response.data.user);
      removeScopedStorageItem('pendingRole');
      removeScopedStorageItem('pendingAccountType');
      setActiveRole(null);
      return response.data.user;
    } catch (error) {
      api.clearTokens();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithPhone = async (phone: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.loginWithPhone(phone, password);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Login failed');
      }

      setUser(response.data.user);
      removeScopedStorageItem('pendingRole');
      removeScopedStorageItem('pendingAccountType');
      setActiveRole(null);
      return response.data.user;
    } finally {
      setIsLoading(false);
    }
  };

  const registerGuest = async (email: string, password: string, role: UserRole) => {
    setIsLoading(true);
    try {
      const response = await api.registerGuest(email, password, role);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Registration failed');
      }

      setUser(response.data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const registerMember = async (phone: string, password: string, role: UserRole) => {
    setIsLoading(true);
    try {
      const response = await api.registerMember(phone, password, role);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Registration failed');
      }

      setUser(response.data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    // Always clear tokens locally regardless of api.logout() result
    api.clearTokens();
    setUser(null);
    setActiveRole(null);
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await api.getCurrentUser();
      if (response.success && response.data) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        activeRole,
        login,
        loginWithTokens,
        loginWithPhone,
        registerGuest,
        registerMember,
        logout,
        setActiveRole,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
