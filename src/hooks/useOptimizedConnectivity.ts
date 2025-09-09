import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface OptimizedConnectivityState {
  isOnline: boolean;
  isTransitioning: boolean;
  lastCheck: Date | null;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  dbConnectionStatus: 'connected' | 'disconnected' | 'checking';
  error: string | null;
}

// Aggressive caching for faster mode switching
let connectivityCache: { 
  result: boolean; 
  timestamp: number; 
  quality: string;
} | null = null;

const CACHE_DURATION = 30000; // 30 seconds cache
const TRANSITION_TIMEOUT = 2000; // Max 2 seconds for mode switch
const DEBOUNCE_DELAY = 500; // Debounce rapid changes

export function useOptimizedConnectivity() {
  const [state, setState] = useState<OptimizedConnectivityState>({
    isOnline: navigator.onLine,
    isTransitioning: false,
    lastCheck: null,
    connectionQuality: 'unknown',
    dbConnectionStatus: 'checking',
    error: null,
  });

  const checkInProgress = useRef(false);
  const transitionTimer = useRef<NodeJS.Timeout | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastCheckTime = useRef<number>(0);

  // Fast connectivity check with aggressive caching
  const checkConnectivity = useCallback(async (force = false) => {
    if (checkInProgress.current) return;
    
    const now = Date.now();
    
    // Use cached result if available and recent
    if (!force && connectivityCache && now - connectivityCache.timestamp < CACHE_DURATION) {
      setState(prev => ({
        ...prev,
        isOnline: connectivityCache!.result,
        connectionQuality: connectivityCache!.quality as any,
        dbConnectionStatus: connectivityCache!.result ? 'connected' : 'disconnected',
        lastCheck: new Date(connectivityCache!.timestamp),
        isTransitioning: false,
        error: null,
      }));
      return;
    }

    // Throttle checks
    if (!force && now - lastCheckTime.current < 5000) {
      return;
    }

    checkInProgress.current = true;
    lastCheckTime.current = now;
    
    try {
      // Start transition state
      setState(prev => ({ ...prev, isTransitioning: true, error: null }));
      
      const startTime = Date.now();
      
      // Browser check first (instant)
      const browserOnline = navigator.onLine;
      if (!browserOnline) {
        connectivityCache = { result: false, timestamp: now, quality: 'unknown' };
        setState({
          isOnline: false,
          isTransitioning: false,
          lastCheck: new Date(),
          connectionQuality: 'unknown',
          dbConnectionStatus: 'disconnected',
          error: null,
        });
        return;
      }

      // Fast network check with timeout
      const connectivityPromise = invoke('check_connectivity_cached');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), TRANSITION_TIMEOUT)
      );
      
      const isConnected = await Promise.race([connectivityPromise, timeoutPromise]) as boolean;
      const responseTime = Date.now() - startTime;
      
      // Determine quality based on response time
      let quality: 'excellent' | 'good' | 'poor' | 'unknown' = 'unknown';
      if (isConnected) {
        if (responseTime < 200) quality = 'excellent';
        else if (responseTime < 800) quality = 'good';
        else quality = 'poor';
      }
      
      // Cache the result
      connectivityCache = { result: isConnected, timestamp: now, quality };
      
      setState({
        isOnline: isConnected,
        isTransitioning: false,
        lastCheck: new Date(),
        connectionQuality: quality,
        dbConnectionStatus: isConnected ? 'connected' : 'disconnected',
        error: null,
      });
      
    } catch (error) {
      console.warn('Fast connectivity check failed:', error);
      
      // Fallback to browser status
      const browserOnline = navigator.onLine;
      connectivityCache = { result: browserOnline, timestamp: now, quality: 'poor' };
      
      setState({
        isOnline: browserOnline,
        isTransitioning: false,
        lastCheck: new Date(),
        connectionQuality: browserOnline ? 'poor' : 'unknown',
        dbConnectionStatus: browserOnline ? 'checking' : 'disconnected',
        error: error instanceof Error ? error.message : 'Connection check failed',
      });
    } finally {
      checkInProgress.current = false;
    }
  }, []);

  // Debounced connectivity check
  const debouncedCheck = useCallback((force = false) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      checkConnectivity(force);
    }, DEBOUNCE_DELAY);
  }, [checkConnectivity]);

  // Force refresh (clears cache)
  const forceRefresh = useCallback(() => {
    connectivityCache = null;
    checkConnectivity(true);
  }, [checkConnectivity]);

  // Handle browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Browser online detected');
      
      // Clear transition timer
      if (transitionTimer.current) {
        clearTimeout(transitionTimer.current);
      }
      
      // Set transition state immediately
      setState(prev => ({ ...prev, isTransitioning: true }));
      
      // Clear cache and check with small delay
      connectivityCache = null;
      transitionTimer.current = setTimeout(() => {
        checkConnectivity(true);
      }, 300);
    };

    const handleOffline = () => {
      console.log('📵 Browser offline detected');
      
      // Clear timers
      if (transitionTimer.current) {
        clearTimeout(transitionTimer.current);
      }
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      
      // Immediate offline state
      connectivityCache = { result: false, timestamp: Date.now(), quality: 'unknown' };
      setState({
        isOnline: false,
        isTransitioning: false,
        lastCheck: new Date(),
        connectionQuality: 'unknown',
        dbConnectionStatus: 'disconnected',
        error: null,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check with delay
    const initialTimer = setTimeout(() => {
      checkConnectivity(true);
    }, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (initialTimer) clearTimeout(initialTimer);
    };
  }, [checkConnectivity]);

  // Periodic background check (less frequent)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!state.isTransitioning) {
        debouncedCheck();
      }
    }, 60000); // Check every minute when stable

    return () => clearInterval(interval);
  }, [debouncedCheck, state.isTransitioning]);

  return {
    ...state,
    refresh: forceRefresh,
    checkConnectivity: debouncedCheck,
  };
}