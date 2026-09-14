import { useState, useEffect } from 'react';
import { auth } from '../api/client';
import axios from 'axios';

interface AuthUser {
  id: string;
  username: string;
  discriminator: string;
  globalName: string | null;
  avatar: string;
}

interface UseAuthResult {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async (): Promise<void> => {
      try {
        const response = await auth.getMe();
        setUser(response.data as AuthUser);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          setUser(null);
        } else {
          setError('Failed to load user information');
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchUser();
  }, []);

  const logout = async (): Promise<void> => {
    try {
      await auth.logout();
      setUser(null);
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  return { user, loading, error, logout };
}
