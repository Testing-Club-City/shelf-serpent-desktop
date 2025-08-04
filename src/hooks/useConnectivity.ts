import { useState, useEffect } from 'react';

interface ConnectivityStatus {
  isOnline: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useConnectivity() {
  const [status, setStatus] = useState<ConnectivityStatus>({
    isOnline: navigator.onLine,
    isLoading: false,
    error: null,
  });

  const checkTauriConnectivity = async () => {
    try {
      setStatus(prev => ({ ...prev, isLoading: true, error: null }));
      
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const { invoke } = await import('@tauri-apps/api/core');
        
        // Try to get sync status from Tauri
        const syncStatus = await invoke('get_sync_status');
        setStatus(prev => ({ 
          ...prev, 
          isOnline: (syncStatus as any).is_online,
          isLoading: false 
        }));
      } else {
        // Fallback to browser detection
        setStatus(prev => ({ 
          ...prev, 
          isOnline: navigator.onLine,
          isLoading: false 
        }));
      }
    } catch (error) {
      console.error('Tauri connectivity check failed:', error);
      // Fallback to browser detection on error
      setStatus(prev => ({ 
        ...prev, 
        isOnline: navigator.onLine,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };

  const forceRefresh = async () => {
    await checkTauriConnectivity();
  };

  useEffect(() => {
    // Initial check
    checkTauriConnectivity();

    // Set up event listeners for browser online/offline
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll for Tauri status every 10 seconds
    const interval = setInterval(checkTauriConnectivity, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return {
    ...status,
    forceRefresh,
    isTauriAvailable: typeof window !== 'undefined' && !!(window as any).__TAURI__,
  };
}
