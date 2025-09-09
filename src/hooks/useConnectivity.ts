import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface ConnectivityState {
  isOnline: boolean;
  isLoading: boolean;
  error: string | null;
  lastCheck: Date | null;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  dbConnectionStatus: 'connected' | 'disconnected' | 'checking';
}

// Cache connectivity results to reduce requests
let connectivityCache: { result: boolean; timestamp: number } | null = null;
let dbConnectivityCache: { result: boolean; timestamp: number } | null = null;
const CACHE_DURATION = 15000; // 15 seconds cache
const CHECK_INTERVAL = 30000; // Check every 30 seconds instead of 5

export function useConnectivity() {
  const [state, setState] = useState<ConnectivityState>({
    isOnline: navigator.onLine,
    isLoading: false,
    error: null,
    lastCheck: null,
    connectionQuality: 'unknown',
    dbConnectionStatus: 'checking',
  });

  const checkInProgress = useRef(false);
  const isPaused = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckTime = useRef<number>(0);

  const checkConnectivity = async (force = false) => {
    if (checkInProgress.current || isPaused.current) return;
    
    // Throttle checks - don't check more than once every 10 seconds unless forced
    const now = Date.now();
    if (!force && now - lastCheckTime.current < 10000) {
      return;
    }
    
    checkInProgress.current = true;
    lastCheckTime.current = now;
    const startTime = Date.now();
    
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // First check browser online status - this is instant and reliable
      const browserOnline = navigator.onLine;
      
      // If browser says offline, don't make network requests
      if (!browserOnline) {
        setState({
          isOnline: false,
          isLoading: false,
          error: null,
          lastCheck: new Date(),
          connectionQuality: 'unknown',
          dbConnectionStatus: 'disconnected',
        });
        return;
      }
      
      // Check cached connectivity result first
      let isConnected: boolean = browserOnline;
      if (connectivityCache && now - connectivityCache.timestamp < CACHE_DURATION) {
        isConnected = connectivityCache.result;
      } else {
        // Only make network request if cache is stale
        try {
          const connectivityPromise = invoke('check_connectivity_cached');
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connectivity check timeout')), 3000)
          );
          
          const result = await Promise.race([connectivityPromise, timeoutPromise]) as boolean;
          isConnected = result;
          connectivityCache = { result: isConnected, timestamp: now };
        } catch (connectivityError) {
          console.warn('Connectivity check failed or timed out:', connectivityError);
          isConnected = browserOnline; // Fallback to browser status
        }
      }
      
      // Only check database connectivity if we're doing sync operations or forced
      let dbConnected = false;
      if (force || (isConnected && (!dbConnectivityCache || now - dbConnectivityCache.timestamp > CACHE_DURATION * 2))) {
        try {
          const dbPromise = invoke('check_supabase_connection_cached');
          const dbTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('DB check timeout')), 2000)
          );
          
          dbConnected = await Promise.race([dbPromise, dbTimeoutPromise]) as boolean;
          dbConnectivityCache = { result: dbConnected, timestamp: now };
        } catch (dbError) {
          console.warn('Database connectivity check failed or timed out:', dbError);
          // Use cached result if available
          if (dbConnectivityCache) {
            dbConnected = dbConnectivityCache.result;
          }
        }
      } else if (dbConnectivityCache) {
        dbConnected = dbConnectivityCache.result;
      }
      
      const responseTime = Date.now() - startTime;
      let connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown' = 'unknown';
      
      if (isConnected) {
        if (responseTime < 300) {
          connectionQuality = 'excellent';
        } else if (responseTime < 1000) {
          connectionQuality = 'good';
        } else {
          connectionQuality = 'poor';
        }
      }
      
      setState({
        isOnline: isConnected,
        isLoading: false,
        error: null,
        lastCheck: new Date(),
        connectionQuality,
        dbConnectionStatus: dbConnected ? 'connected' : (isConnected ? 'checking' : 'disconnected'),
      });
      
    } catch (error) {
      console.error('Connectivity check failed:', error);
      // Fallback to browser online status
      const browserOnline = navigator.onLine;
      
      setState(prev => ({
        ...prev,
        isOnline: browserOnline,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Connection check failed',
        connectionQuality: browserOnline ? 'poor' : 'unknown',
        dbConnectionStatus: browserOnline ? 'checking' : 'disconnected',
      }));
    } finally {
      checkInProgress.current = false;
    }
  };

  // Function to pause connectivity checks during processing
  const pauseChecks = () => {
    console.log('🔇 Pausing connectivity checks during processing');
    isPaused.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Function to resume connectivity checks after processing
  const resumeChecks = () => {
    console.log('🔊 Resuming connectivity checks after processing');
    isPaused.current = false;
    if (!intervalRef.current) {
      // Restart the interval with longer duration
      intervalRef.current = setInterval(() => checkConnectivity(), CHECK_INTERVAL);
    }
  };

  // Force refresh function for manual checks
  const forceRefresh = () => {
    connectivityCache = null;
    dbConnectivityCache = null;
    checkConnectivity(true);
  };

  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Browser detected online status');
      setState(prev => ({ ...prev, isOnline: true }));
      // Clear cache and check immediately when coming online
      connectivityCache = null;
      dbConnectivityCache = null;
      if (!isPaused.current) {
        setTimeout(() => checkConnectivity(true), 1000); // Small delay to let network stabilize
      }
    };

    const handleOffline = () => {
      console.log('📵 Browser detected offline status');
      setState(prev => ({ 
        ...prev, 
        isOnline: false,
        dbConnectionStatus: 'disconnected',
        connectionQuality: 'unknown',
      }));
      // Clear cache when going offline
      connectivityCache = null;
      dbConnectivityCache = null;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check with delay to let app initialize
    setTimeout(() => {
      if (!isPaused.current) {
        checkConnectivity(true);
      }
    }, 2000);

    // Periodic checks with longer interval
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        if (!isPaused.current) {
          checkConnectivity();
        }
      }, CHECK_INTERVAL);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Helper function to get connection status text
  const getConnectionStatusText = () => {
    if (!state.isOnline) return 'Offline';
    if (state.dbConnectionStatus === 'connected') return 'Online - Database Connected';
    if (state.dbConnectionStatus === 'checking') return 'Online - Database Checking';
    return 'Online - Database Unavailable';
  };

  // Helper function to get connection status icon
  const getConnectionStatusIcon = () => {
    if (!state.isOnline) return '🔴';
    if (state.dbConnectionStatus === 'connected') return '🟢';
    if (state.dbConnectionStatus === 'checking') return '🟡';
    return '🟠';
  };

  return {
    ...state,
    refresh: forceRefresh,
    pauseChecks,
    resumeChecks,
    getConnectionStatusText,
    getConnectionStatusIcon,
  };
}
