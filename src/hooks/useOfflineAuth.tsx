import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { invoke } from '@tauri-apps/api/core';

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

interface OfflineAuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isOnline: boolean;
  isOfflineMode: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkOfflineSession: (skipOnlineAuth?: boolean) => Promise<boolean>;
}

const OfflineAuthContext = createContext<OfflineAuthContextType | undefined>(undefined);

export const OfflineAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const { toast } = useToast();

  // Check if we're in Tauri environment
  const isTauriApp = typeof window !== 'undefined' && !!(window as any).__TAURI__;
  
  // For Tauri desktop, be more aggressive with fast startup
  const isDesktop = isTauriApp;

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsOfflineMode(false);
      toast({
        title: 'Back Online',
        description: 'Connection restored. Syncing data...',
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsOfflineMode(true);
      toast({
        title: 'Offline Mode',
        description: 'Working offline with cached data.',
        variant: 'default',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Generate device fingerprint for session security
  const generateDeviceFingerprint = (): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('fingerprint', 10, 10);
    const canvasFingerprint = canvas.toDataURL();
    
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}`,
      canvas: canvasFingerprint.substring(0, 50), // Truncate for storage
    };
    
    return btoa(JSON.stringify(fingerprint));
  };

  // Save session for offline use
  const saveOfflineSession = async (session: any, user: User) => {
    try {
      if (!isTauriApp) {
        // In browser environment, use localStorage as fallback
        const userSession = {
          user_id: user.id,
          email: user.email || '',
          access_token: session.access_token,
          expires_at: new Date(session.expires_at * 1000).toISOString(),
          user_metadata: JSON.stringify(user.user_metadata || {}),
          role: user.user_metadata?.role || 'user',
          created_at: new Date().toISOString(),
          session_valid: true,
          offline_expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };
        localStorage.setItem('offline_session', JSON.stringify(userSession));
        console.log('Session saved to localStorage for browser environment');
        return;
      }

      const userSession: UserSession = {
        id: crypto.randomUUID(),
        user_id: user.id,
        email: user.email || '',
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: new Date(session.expires_at * 1000).toISOString(),
        user_metadata: JSON.stringify(user.user_metadata || {}),
        role: user.user_metadata?.role || 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        session_valid: true,
        offline_expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        device_fingerprint: generateDeviceFingerprint(),
      };

      await invoke('save_user_session', { sessionData: userSession });
      console.log('Session saved for offline use');
    } catch (error) {
      console.error('Failed to save offline session:', error);
    }
  };

  // Check for valid offline session
  const checkOfflineSession = async (skipOnlineAuth: boolean = false): Promise<boolean> => {
    try {
      setLoading(true);
      
      if (!isTauriApp) {
        // In browser environment, check localStorage
        const cachedSession = localStorage.getItem('offline_session');
        if (cachedSession) {
          const sessionData = JSON.parse(cachedSession);
          const isValidOffline = new Date(sessionData.offline_expiry) > new Date();
          
          if (isValidOffline) {
            const cachedUser: User = {
              id: sessionData.user_id,
              email: sessionData.email,
              user_metadata: JSON.parse(sessionData.user_metadata),
              app_metadata: {},
              aud: 'authenticated',
              created_at: sessionData.created_at,
              role: sessionData.role,
            };
            
            console.log('checkOfflineSession: Valid offline session found in localStorage');
            setUser(cachedUser);
            if (!isOnline) {
              setIsOfflineMode(true);
              toast({
                title: 'Offline Session Restored',
                description: `Welcome back, ${sessionData.email}. Working offline.`,
              });
            }
            setLoading(false);
            return true; // Valid session found
          }
        }
        
        // No valid browser session, proceed with online auth if available
        if (isOnline && !skipOnlineAuth) {
          await checkOnlineAuth(true);
        } else {
          setUser(null);
          setIsOfflineMode(false);
        }
        setLoading(false);
        return false; // No valid session found
      }
      
      // Tauri environment - use invoke calls
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
      
      const result = await Promise.race([
        invoke('get_cached_user_session', { userId: 'any' }),
        timeoutPromise
      ]);
      const cachedSession = result as UserSession | null;

      if (cachedSession && cachedSession.session_valid) {
        const isValidOffline = new Date(cachedSession.offline_expiry) > new Date();
        
        if (isValidOffline) {
          const cachedUser: User = {
            id: cachedSession.user_id,
            email: cachedSession.email,
            user_metadata: cachedSession.user_metadata ? JSON.parse(cachedSession.user_metadata) : {},
            app_metadata: {},
            aud: 'authenticated',
            created_at: cachedSession.created_at,
            role: cachedSession.role,
          };

          console.log('checkOfflineSession: Valid offline session found, setting user:', cachedSession.email);
          setUser(cachedUser);
          
          if (!isOnline) {
            setIsOfflineMode(true);
            toast({
              title: 'Offline Session Restored',
              description: `Welcome back, ${cachedSession.email}. Working offline.`,
            });
          }
          
          console.log('checkOfflineSession: Setting loading=false and returning');
          setLoading(false);
          return true; // Valid session found
        }
      }
      
      // If no valid offline session and we're not skipping online auth
      if (isOnline && !skipOnlineAuth) {
        await checkOnlineAuth(true);
      } else {
        setUser(null);
        setIsOfflineMode(false);
      }
    } catch (error) {
      console.error('Error checking offline session:', error);
      setUser(null);
      setIsOfflineMode(false);
    } finally {
      setLoading(false);
    }
    
    return false; // No valid session found
  };

  // Enhanced session handler that saves for offline use
  const handleSession = async (session: any, isInitialCheck = false) => {
    console.log('Handling session:', { 
      hasSession: !!session, 
      hasUser: !!session?.user,
      userEmail: session?.user?.email,
      isOnline,
      isInitialCheck
    });

    if (!session?.user) {
      if (!isOnline && !isInitialCheck) {
        // If offline and no online session, check for cached session but prevent loops
        const hasOfflineSession = await checkOfflineSession(true); // Skip online auth to prevent recursive calls
        return;
      }
      
      setUser(null);
      setIsOfflineMode(false);
      setLoading(false);
      return;
    }

    try {
      // For ONLINE mode - only validate with Supabase if we have network
      if (isOnline) {
        try {
          // Skip getUser() call since we're offline-first
          // Instead, rely on the fact that we have a valid session from auth state
          
          // Only check suspension if we can make network calls
          try {
            // Add timeout to prevent hanging on profile check
            const profilePromise = supabase
              .from('profiles')
              .select('suspended')
              .eq('id', session.user.id)
              .single();
            
            const profileTimeout = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Profile check timeout')), 3000);
            });
            
            const profileResult = await Promise.race([profilePromise, profileTimeout]);
            const { data: profile } = profileResult as any;

            if (profile?.suspended) {
              await supabase.auth.signOut();
              if (isTauriApp) {
                await invoke('invalidate_user_session', { userId: session.user.id });
              } else {
                localStorage.removeItem('offline_session');
              }
              setUser(null);
              setIsOfflineMode(false);
              toast({
                title: 'Account Suspended',
                description: 'Your account has been suspended. Please contact administration.',
                variant: 'destructive',
              });
              setLoading(false);
              return;
            }
          } catch (networkError) {
            // If network call fails or times out, assume user is not suspended and continue
            console.warn('Could not check suspension status (offline mode assumed):', networkError);
          }

          // Save session for offline use with timeout
          try {
            const saveTimeout = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Save session timeout')), 2000);
            });
            
            await Promise.race([
              saveOfflineSession(session, session.user),
              saveTimeout
            ]);
            console.log('Session saved successfully');
          } catch (saveError) {
            console.warn('Failed to save session for offline use:', saveError);
            // Continue anyway - this is not critical for login
          }
          
          setIsOfflineMode(false);
        } catch (error) {
          console.error('Online session handling error:', error);
          // Don't fallback to prevent recursive calls
          setUser(null);
          setLoading(false);
          return;
        }
      } else {
        // OFFLINE mode - use cached session validation
        if (isTauriApp) {
          // Check if cached session is still valid via Tauri
          const result = await invoke('is_session_valid_offline', { userId: session.user.id });
          const isValid = result as boolean;
          
          if (!isValid) {
            setUser(null);
            setIsOfflineMode(false);
            setLoading(false);
            return;
          }
        } else {
          // Browser environment - check localStorage
          const cachedSession = localStorage.getItem('offline_session');
          if (cachedSession) {
            const sessionData = JSON.parse(cachedSession);
            const isValidOffline = new Date(sessionData.offline_expiry) > new Date();
            if (!isValidOffline) {
              setUser(null);
              setIsOfflineMode(false);
              setLoading(false);
              return;
            }
          } else {
            setUser(null);
            setIsOfflineMode(false);
            setLoading(false);
            return;
          }
        }
        
        setIsOfflineMode(true);
      }

      setUser(session.user);
      setLoading(false);
    } catch (error) {
      console.error('Session handling error:', error);
      // Don't fallback to prevent recursive calls
      setUser(null);
      setLoading(false);
    }
  };

  // Check online authentication - simplified for offline-first
  const checkOnlineAuth = async (skipOfflineAuth: boolean = false) => {
    try {
      if (!isTauriApp) {
        // Browser environment - check localStorage first
        const cachedSession = localStorage.getItem('offline_session');
        if (cachedSession) {
          console.log('Found cached session in localStorage, using it');
          const sessionData = JSON.parse(cachedSession);
          const cachedUser: User = {
            id: sessionData.user_id,
            email: sessionData.email,
            user_metadata: JSON.parse(sessionData.user_metadata),
            app_metadata: {},
            aud: 'authenticated',
            created_at: sessionData.created_at,
            role: sessionData.role,
          };
          setUser(cachedUser);
          setIsOfflineMode(false);
          setLoading(false);
          return;
        }
      } else {
        // Tauri environment - check cached session via invoke
        const cachedSession = await invoke('get_cached_user_session', { userId: 'any' });
        if (cachedSession) {
          console.log('Found cached session in Tauri, using it');
          const sessionData = cachedSession as UserSession;
          
          // Create User object from cached session
          const cachedUser: User = {
            id: sessionData.user_id,
            email: sessionData.email,
            user_metadata: sessionData.user_metadata ? JSON.parse(sessionData.user_metadata) : {},
            app_metadata: {},
            aud: 'authenticated',
            created_at: sessionData.created_at,
            role: sessionData.role,
          };
          
          setUser(cachedUser);
          setIsOfflineMode(false);
          setLoading(false);
          return;
        }
      }

      // If no cached session and online, check Supabase
      if (isOnline) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Get session error:', error);
          setUser(null);
          setLoading(false);
          return;
        }
        
        if (session?.user) {
          // Save session for offline use
          await saveOfflineSession(session, session.user);
          setUser(session.user);
          setIsOfflineMode(false);
        } else {
          setUser(null);
        }
      } else {
        // Offline and no cached session
        setUser(null);
      }
    } catch (error) {
      console.error('Online auth check error:', error);
      // Don't fallback to offline session to prevent infinite loops
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Initialize auth
  useEffect(() => {
    let mounted = true;
    let initTimeout: NodeJS.Timeout;

    const initializeAuth = async () => {
      // Prevent multiple concurrent initializations
      if (isInitializing) {
        console.log('Auth initialization already in progress, skipping');
        return;
      }

      try {
        setIsInitializing(true);
        
        // Add very aggressive timeout to prevent hanging - desktop gets faster timeout
        const timeoutMs = isDesktop ? 1000 : 2000; // 1 second for desktop, 2 for web
        initTimeout = setTimeout(() => {
          if (mounted) {
            console.log(`Auth initialization timed out after ${timeoutMs}ms, proceeding without auth`);
            setUser(null);
            setLoading(false);
            setIsInitializing(false);
          }
        }, timeoutMs);

        // Always check cached session first (fast, works offline)
        console.log('Initializing auth - checking cached session first');
        
        try {
          const cacheTimeoutMs = isDesktop ? 500 : 1000; // Even faster for desktop
          const hasOfflineSession = await Promise.race([
            checkOfflineSession(true), // Skip online auth to prevent loops
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), cacheTimeoutMs))
          ]);
          
          // Clear timeout if we completed successfully
          if (initTimeout) clearTimeout(initTimeout);
          
          // If we have a cached session, we're done
          if (hasOfflineSession) {
            console.log('Using cached session for fast startup');
            setIsInitializing(false);
            return;
          }
          
          // Only check Supabase if online and no cached session
          if (isOnline) {
            console.log('No cached session, checking Supabase with timeout');
            const onlineTimeoutMs = isDesktop ? 500 : 1000; // Even faster for desktop
            await Promise.race([
              checkOnlineAuth(true), // Skip offline auth to prevent loops
              new Promise<void>((resolve) => setTimeout(() => resolve(), onlineTimeoutMs))
            ]);
          } else {
            // If offline and no cached session, set loading to false
            setLoading(false);
          }
        } catch (error) {
          console.error('Auth check error:', error);
          setUser(null);
          setLoading(false);
        }
        
        if (initTimeout) clearTimeout(initTimeout);
        setIsInitializing(false);
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setUser(null);
          setLoading(false);
          setIsInitializing(false);
        }
        if (initTimeout) clearTimeout(initTimeout);
      }
    };

    if (mounted) {
      initializeAuth();
    }

    return () => {
      mounted = false;
      if (initTimeout) clearTimeout(initTimeout);
    };
  }, []); // Remove isOnline dependency to prevent re-initialization

  // Safety mechanism - ensure loading never stays true indefinitely
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.log('Safety timeout triggered - forcing loading=false');
        setLoading(false);
        setIsInitializing(false);
      }
    }, 6000); // Reduced to 6 second absolute maximum for better UX

    return () => clearTimeout(safetyTimeout);
  }, [loading]);

  // Additional safety for login state - if loading stays true during login, force completion
  useEffect(() => {
    if (loading && !isInitializing) {
      const loginSafetyTimeout = setTimeout(() => {
        console.log('Login safety timeout - forcing completion');
        setLoading(false);
        
        // If we're in a login state but stuck, try to recover by checking auth
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            console.log('Found valid session during safety recovery');
            setUser(session.user);
            toast({
              title: 'Login Completed',
              description: 'Successfully logged in',
            });
          }
        }).catch(console.error);
      }, 4000); // 4 second timeout for login operations
      
      return () => clearTimeout(loginSafetyTimeout);
    }
  }, [loading, isInitializing]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user) {
        await handleSession(session, false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsOfflineMode(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        await handleSession(session, false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [isOnline]);

  const login = async (email: string, password: string): Promise<boolean> => {
    if (!isOnline) {
      toast({
        title: 'Offline Mode',
        description: 'Cannot login while offline. Please check your connection.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      setLoading(true);
      console.log('Login: Starting login process...');
      
      // Add timeout to the entire login process
      const loginPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      const loginTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Login timeout')), 10000);
      });
      
      const loginResult = await Promise.race([loginPromise, loginTimeout]);
      const { data, error } = loginResult as any;

      if (error) {
        console.error('Login error:', error);
        toast({
          title: 'Login Failed',
          description: error.message,
          variant: 'destructive',
        });
        setLoading(false);
        return false;
      }

      if (!data.user || !data.session) {
        console.log('Login: No user or session returned');
        setLoading(false);
        return false;
      }

      console.log('Login: Successful login, handling session...');
      
      // Handle the session with timeout
      const sessionTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Session handling timeout')), 5000);
      });
      
      try {
        await Promise.race([
          handleSession(data.session, false),
          sessionTimeout
        ]);
        
        console.log('Login: Session handled successfully, user set to:', data.user.email);
        toast({
          title: 'Success',
          description: 'Logged in successfully',
        });
        console.log('Login: Returning success, isAuthenticated should now be true');
        return true;
      } catch (sessionError) {
        console.error('Session handling error:', sessionError);
        // Even if session handling fails, we can still set the user manually
        setUser(data.user);
        setLoading(false);
        toast({
          title: 'Success',
          description: 'Logged in successfully',
        });
        return true;
      }

    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setLoading(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      
      // Invalidate local session
      if (user) {
        if (isTauriApp) {
          await invoke('invalidate_user_session', { userId: user.id });
        } else {
          localStorage.removeItem('offline_session');
        }
      }

      // Sign out from Supabase (if online)
      if (isOnline) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }

      setUser(null);
      setIsOfflineMode(false);
      
      toast({
        title: 'Logged Out',
        description: 'You have been logged out successfully.',
      });
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: 'Error',
        description: 'Failed to log out completely',
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
    isOnline,
    isOfflineMode,
    login,
    logout,
    checkOfflineSession,
  };

  return <OfflineAuthContext.Provider value={value}>{children}</OfflineAuthContext.Provider>;
};

export const useOfflineAuth = () => {
  const context = useContext(OfflineAuthContext);
  if (context === undefined) {
    throw new Error('useOfflineAuth must be used within an OfflineAuthProvider');
  }
  return context;
};
