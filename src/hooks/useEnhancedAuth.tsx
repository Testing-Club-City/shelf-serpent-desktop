import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddlzenlqkofefdwdefzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface UserSession {
  id: string;
  user_id: string;
  email: string;
  access_token: string;
  refresh_token?: string;
  expires_at: string;
  user_metadata?: string;
  role: string;
  created_at: string;
  updated_at: string;
  last_activity: string;
  session_valid: boolean;
  offline_expiry: string;
  device_fingerprint?: string;
}

interface AuthCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  session?: UserSession;
  error?: string;
  is_offline: boolean;
}

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  isOffline: boolean;
  signIn: (credentials: AuthCredentials) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // Check for stored session on app start
  const checkStoredSession = useCallback(async () => {
    try {
      setLoading(true);
      
      // First, check if we have a valid online session
      const { data: { session }, error } = await Promise.race([
        supabase.auth.getSession(),
        new Promise<{ data: { session: null }, error: Error }>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        )
      ]);

      if (session && !error) {
        // Online session is valid, store it for offline use
        const userSession: UserSession = {
          id: session.user?.id || '',
          user_id: session.user?.id || '',
          email: session.user?.email || '',
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
          user_metadata: JSON.stringify(session.user?.user_metadata || {}),
          role: session.user?.role || 'user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          session_valid: true,
          offline_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        };

        await invoke('store_authenticated_session', { sessionData: userSession });
        setUser(userSession);
        setIsOffline(false);
        return;
      }
    } catch (onlineError) {
      console.log('Online session check failed, trying offline session...');
    }

    // Try to get stored session for offline authentication
    try {
      const lastEmail = localStorage.getItem('lastLoginEmail');
      if (lastEmail) {
        const storedSession = await invoke<UserSession | null>('get_stored_session', { 
          email: lastEmail 
        });
        
        if (storedSession) {
          setUser(storedSession);
          setIsOffline(true);
          console.log('Offline session restored for:', lastEmail);
          return;
        }
      }
    } catch (offlineError) {
      console.error('Failed to check stored session:', offlineError);
    }

    // No valid session found
    setUser(null);
    setIsOffline(false);
  }, []);

  // Enhanced sign in with offline-first approach
  const signIn = useCallback(async (credentials: AuthCredentials): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);

      // First try offline authentication
      const offlineResponse = await invoke<AuthResponse>('authenticate_user', { 
        credentials 
      });

      if (offlineResponse.success && offlineResponse.session) {
        setUser(offlineResponse.session);
        setIsOffline(true);
        localStorage.setItem('lastLoginEmail', credentials.email);
        return { success: true };
      }

      // If offline auth fails, try online authentication
      try {
        const { data, error } = await Promise.race([
          supabase.auth.signInWithPassword(credentials),
          new Promise<{ data: null, error: Error }>((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), 5000)
          )
        ]);

        if (error) {
          return { success: false, error: error.message };
        }

        if (data.session) {
          // Store session for offline use
          const userSession: UserSession = {
            id: data.session.user?.id || '',
            user_id: data.session.user?.id || '',
            email: data.session.user?.email || '',
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            user_metadata: JSON.stringify(data.session.user?.user_metadata || {}),
            role: data.session.user?.role || 'user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_activity: new Date().toISOString(),
            session_valid: true,
            offline_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          };

          await invoke('store_authenticated_session', { sessionData: userSession });
          setUser(userSession);
          setIsOffline(false);
          localStorage.setItem('lastLoginEmail', credentials.email);
          
          return { success: true };
        }
      } catch (onlineError) {
        console.error('Online authentication failed:', onlineError);
        return { 
          success: false, 
          error: 'Unable to connect to authentication server. Please check your internet connection.' 
        };
      }

      return { success: false, error: 'Authentication failed' };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: 'Authentication system error' };
    } finally {
      setLoading(false);
    }
  }, []);

  // Enhanced sign out
  const signOut = useCallback(async () => {
    try {
      if (user) {
        // Invalidate local session
        await invoke('logout_user', { sessionId: user.id });
      }

      // Try to sign out from Supabase if online
      try {
        await Promise.race([
          supabase.auth.signOut(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 2000)
          )
        ]);
      } catch (error) {
        console.log('Online signout failed (offline mode)');
      }

      setUser(null);
      setIsOffline(false);
      localStorage.removeItem('lastLoginEmail');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, [user]);

  // Check session validity
  const checkSession = useCallback(async () => {
    if (!user) return;

    try {
      // Update activity for offline sessions
      if (isOffline) {
        // Just update the last activity locally
        return;
      }

      // For online sessions, try to refresh if needed
      const { data, error } = await Promise.race([
        supabase.auth.getSession(),
        new Promise<{ data: { session: null }, error: Error }>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        )
      ]);

      if (error || !data.session) {
        // Fall back to offline mode
        setIsOffline(true);
      }
    } catch (error) {
      console.log('Session check failed, switching to offline mode');
      setIsOffline(true);
    }
  }, [user, isOffline]);

  // Cleanup expired sessions periodically
  useEffect(() => {
    const cleanup = async () => {
      try {
        await invoke('cleanup_expired_auth_sessions');
      } catch (error) {
        console.error('Failed to cleanup expired sessions:', error);
      }
    };

    // Run cleanup on app start and every hour
    cleanup();
    const interval = setInterval(cleanup, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Check session on app start and periodically
  useEffect(() => {
    checkStoredSession().finally(() => setLoading(false));

    // Check session every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkStoredSession, checkSession]);

  const value: AuthContextType = {
    user,
    loading,
    isOffline,
    signIn,
    signOut,
    checkSession,
  };

  return (
    <AuthContext.Provider value={value}>
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

export { AuthContext };
