import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Function to clear stale auth data
  const clearStaleAuthData = async () => {
    try {
      console.log('Clearing potentially stale auth data...');
      // Clear Supabase session
      await supabase.auth.signOut();
      
      // Clear localStorage items that might be stale
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('Stale auth data cleared');
    } catch (error) {
      console.warn('Error clearing stale auth data:', error);
    }
  };

  // Function to validate session freshness
  const validateSession = async (session: any): Promise<boolean> => {
    if (!session?.access_token) return false;
    
    try {
      // Try to make a simple authenticated request to validate the session
      const { error } = await supabase.auth.getUser();
      if (error) {
        console.warn('Session validation failed:', error.message);
        return false;
      }
      return true;
    } catch (error) {
      console.warn('Session validation error:', error);
      return false;
    }
  };

  // Function to check if user is suspended with aggressive timeout and fallback
  const checkUserSuspension = async (userId: string): Promise<boolean> => {
    try {
      console.log('Checking suspension for user:', userId);
      
      // Very aggressive timeout to prevent hanging (500ms)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Suspension check timeout after 500ms')), 500);
      });

      const queryPromise = supabase
        .from('profiles')
        .select('suspended')
        .eq('id', userId)
        .single();

      const { data: profile, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        console.warn('Profile check error, proceeding with auth:', error.message);
        // For ANY error, assume not suspended to prevent auth blocking
        return false;
      }

      const isSuspended = profile?.suspended || false;
      console.log('Suspension check completed:', { isSuspended, profile });
      return isSuspended;
      
    } catch (error) {
      console.warn('Suspension check failed, allowing auth to proceed:', error);
      // NEVER block authentication if suspension check fails
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;
    let authTimeoutId: NodeJS.Timeout;

    // Safety timeout to prevent infinite loading
    const setAuthTimeout = () => {
      authTimeoutId = setTimeout(() => {
        if (mounted && loading) {
          console.warn('Authentication timeout reached, forcing completion');
          setLoading(false);
          setUser(null);
        }
      }, 5000); // Reduced to 5 seconds for faster recovery
    };

    const clearAuthTimeout = () => {
      if (authTimeoutId) {
        clearTimeout(authTimeoutId);
      }
    };

    const handleSession = async (session: any) => {
      console.log('Handling session:', { 
        hasSession: !!session, 
        hasUser: !!session?.user,
        userEmail: session?.user?.email,
        tokenExists: !!session?.access_token
      });
      
      if (!session?.user) {
        console.log('No session or user, setting as unauthenticated');
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        // Add timeout to the entire session handling process
        const sessionTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Session handling timeout after 3s')), 3000);
        });

        const handleSessionPromise = (async () => {
          // First, validate the session is actually valid
          const isValidSession = await validateSession(session);
          if (!isValidSession) {
            console.warn('Invalid session detected, clearing auth state');
            await clearStaleAuthData();
            if (mounted) {
              setUser(null);
              setLoading(false);
            }
            return;
          }

          // Only check suspension if session is valid
          console.log('Valid session, checking suspension status...');
          const isSuspended = await checkUserSuspension(session.user.id);
          
          if (isSuspended) {
            console.log('User is suspended, signing out');
            await supabase.auth.signOut();
            if (mounted) {
              setUser(null);
              setLoading(false);
              toast({
                title: 'Account Suspended',
                description: 'Your account has been suspended. Please contact administration.',
                variant: 'destructive',
              });
            }
          } else if (mounted) {
            console.log('Setting user as authenticated:', session.user.email);
            setUser(session.user);
            setLoading(false);
          }
        })();

        await Promise.race([handleSessionPromise, sessionTimeoutPromise]);

      } catch (error) {
        console.error('Session handling error:', error);
        if (mounted) {
          // If there's an error but we have a session, set the user anyway (fallback)
          console.log('Setting user despite error (fallback):', session.user.email);
          setUser(session.user);
          setLoading(false);
        }
      }
    };

    // Initial session check
    const initializeAuth = async () => {
      console.log('Initializing authentication...');
      setAuthTimeout(); // Start the safety timeout
      
      try {
        // Check for potentially stale tokens in localStorage
        const storedSession = localStorage.getItem('supabase.auth.token');
        if (storedSession) {
          try {
            const parsedSession = JSON.parse(storedSession);
            if (parsedSession.expires_at && new Date(parsedSession.expires_at * 1000) < new Date()) {
              console.log('Detected expired token in localStorage, clearing...');
              await clearStaleAuthData();
            }
          } catch (e) {
            console.warn('Could not parse stored session, clearing...');
            await clearStaleAuthData();
          }
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Get session error:', error);
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          clearAuthTimeout();
          return;
        }

        console.log('Initial session check:', { 
          hasSession: !!session, 
          userEmail: session?.user?.email,
          expiresAt: session?.expires_at 
        });
        
        await handleSession(session);
        clearAuthTimeout();
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        clearAuthTimeout();
      }
    };

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email, { hasToken: !!session?.access_token });
      
      // Clear any existing timeout when auth state changes
      clearAuthTimeout();
      
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        // Handle these events immediately without extra checks
        await handleSession(session);
      } else {
        // For other events, handle normally
        await handleSession(session);
      }
    });

    // Initialize auth
    initializeAuth();

    return () => {
      mounted = false;
      clearAuthTimeout();
      subscription.unsubscribe();
    };
  }, [toast]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        toast({
          title: 'Login Failed',
          description: error.message,
          variant: 'destructive',
        });
        return false;
      }

      if (!data.user) {
        return false;
      }

      const isSuspended = await checkUserSuspension(data.user.id);
      
      if (isSuspended) {
        await supabase.auth.signOut();
        toast({
          title: 'Account Suspended',
          description: 'Your account has been suspended. Please contact administration.',
          variant: 'destructive',
        });
        return false;
      }

      setUser(data.user);
      toast({
        title: 'Success',
        description: 'Logged in successfully',
      });
      return true;

    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: 'Error',
        description: 'Failed to log out',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user && !loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
