import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface SmartSyncState {
  isSyncing: boolean;
  lastSync: Date | null;
  syncProgress: number;
  pendingChanges: number;
  error: string | null;
  mode: 'idle' | 'background' | 'priority' | 'emergency';
}

interface SyncResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  duration: number;
  errors: string[];
}

// Smart sync that adapts to connection quality and data volume
export function useSmartSync() {
  const [state, setState] = useState<SmartSyncState>({
    isSyncing: false,
    lastSync: null,
    syncProgress: 0,
    pendingChanges: 0,
    error: null,
    mode: 'idle',
  });

  const syncInProgress = useRef(false);
  const syncQueue = useRef<string[]>([]);
  const lastSyncAttempt = useRef<number>(0);

  // Intelligent sync based on connection quality and data volume
  const performSmartSync = useCallback(async (
    priority: 'low' | 'normal' | 'high' = 'normal',
    tables?: string[]
  ): Promise<SyncResult> => {
    if (syncInProgress.current) {
      throw new Error('Sync already in progress');
    }

    const now = Date.now();
    const timeSinceLastSync = now - lastSyncAttempt.current;
    
    // Prevent too frequent syncs
    if (priority === 'low' && timeSinceLastSync < 30000) {
      throw new Error('Sync rate limited');
    }

    syncInProgress.current = true;
    lastSyncAttempt.current = now;
    
    try {
      setState(prev => ({
        ...prev,
        isSyncing: true,
        syncProgress: 0,
        error: null,
        mode: priority === 'high' ? 'priority' : 'background',
      }));

      const startTime = Date.now();
      let result: SyncResult;

      if (tables && tables.length > 0) {
        // Selective sync for specific tables
        result = await performSelectiveSync(tables);
      } else {
        // Check pending changes first
        const pendingCount = await invoke<number>('get_pending_changes_count');
        
        setState(prev => ({ ...prev, pendingChanges: pendingCount }));

        if (pendingCount === 0 && priority === 'low') {
          // No changes to sync
          result = {
            success: true,
            uploaded: 0,
            downloaded: 0,
            duration: Date.now() - startTime,
            errors: [],
          };
        } else if (pendingCount < 100) {
          // Light sync for small changes
          result = await performLightSync();
        } else {
          // Full sync for large changes
          result = await performFullSync();
        }
      }

      setState(prev => ({
        ...prev,
        isSyncing: false,
        lastSync: new Date(),
        syncProgress: 100,
        pendingChanges: Math.max(0, prev.pendingChanges - result.uploaded),
        error: result.errors.length > 0 ? result.errors[0] : null,
        mode: 'idle',
      }));

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      
      setState(prev => ({
        ...prev,
        isSyncing: false,
        syncProgress: 0,
        error: errorMessage,
        mode: 'idle',
      }));

      throw error;
    } finally {
      syncInProgress.current = false;
    }
  }, []);

  // Light sync for small changes (< 100 records)
  const performLightSync = async (): Promise<SyncResult> => {
    const startTime = Date.now();
    
    try {
      // Upload local changes first (faster)
      setState(prev => ({ ...prev, syncProgress: 25 }));
      const uploadResult = await invoke<any>('upload_local_changes');
      
      setState(prev => ({ ...prev, syncProgress: 75 }));
      
      // Only download critical tables
      const criticalTables = ['borrowings', 'students', 'books'];
      let totalDownloaded = 0;
      
      for (const table of criticalTables) {
        try {
          const count = await invoke<number>(`sync_${table}_incremental`);
          totalDownloaded += count;
        } catch (error) {
          console.warn(`Failed to sync ${table}:`, error);
        }
      }

      setState(prev => ({ ...prev, syncProgress: 100 }));

      return {
        success: true,
        uploaded: uploadResult.uploaded || 0,
        downloaded: totalDownloaded,
        duration: Date.now() - startTime,
        errors: uploadResult.errors || [],
      };
    } catch (error) {
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        duration: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Light sync failed'],
      };
    }
  };

  // Full sync for large changes or initial sync
  const performFullSync = async (): Promise<SyncResult> => {
    const startTime = Date.now();
    
    try {
      setState(prev => ({ ...prev, syncProgress: 10 }));
      
      // Use the optimized comprehensive sync
      const result = await invoke<any>('fixed_comprehensive_sync');
      
      setState(prev => ({ ...prev, syncProgress: 100 }));

      return {
        success: result.success || false,
        uploaded: result.uploaded || 0,
        downloaded: result.downloaded || 0,
        duration: Date.now() - startTime,
        errors: result.errors || [],
      };
    } catch (error) {
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        duration: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Full sync failed'],
      };
    }
  };

  // Selective sync for specific tables
  const performSelectiveSync = async (tables: string[]): Promise<SyncResult> => {
    const startTime = Date.now();
    let totalUploaded = 0;
    let totalDownloaded = 0;
    const errors: string[] = [];
    
    const progressStep = 100 / tables.length;
    
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      
      try {
        setState(prev => ({ ...prev, syncProgress: i * progressStep }));
        
        // Try table-specific sync command
        const result = await invoke<any>(`sync_${table}_only`);
        if (typeof result === 'number') {
          totalDownloaded += result;
        } else if (result && typeof result === 'object') {
          totalUploaded += result.uploaded || 0;
          totalDownloaded += result.downloaded || 0;
        }
      } catch (error) {
        const errorMsg = `Failed to sync ${table}: ${error}`;
        errors.push(errorMsg);
        console.warn(errorMsg);
      }
    }

    setState(prev => ({ ...prev, syncProgress: 100 }));

    return {
      success: errors.length === 0,
      uploaded: totalUploaded,
      downloaded: totalDownloaded,
      duration: Date.now() - startTime,
      errors,
    };
  };

  // Background sync (low priority, non-blocking)
  const backgroundSync = useCallback(async () => {
    try {
      await performSmartSync('low');
    } catch (error) {
      // Silently handle background sync failures
      console.debug('Background sync failed:', error);
    }
  }, [performSmartSync]);

  // Priority sync (high priority, user-initiated)
  const prioritySync = useCallback(async (tables?: string[]) => {
    return performSmartSync('high', tables);
  }, [performSmartSync]);

  // Auto-sync based on connectivity changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !syncInProgress.current) {
        // App became visible, do background sync
        setTimeout(backgroundSync, 2000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [backgroundSync]);

  // Periodic background sync
  useEffect(() => {
    const interval = setInterval(() => {
      if (!syncInProgress.current && state.mode === 'idle') {
        backgroundSync();
      }
    }, 300000); // Every 5 minutes

    return () => clearInterval(interval);
  }, [backgroundSync, state.mode]);

  return {
    ...state,
    performSmartSync,
    backgroundSync,
    prioritySync,
    isIdle: state.mode === 'idle' && !state.isSyncing,
  };
}