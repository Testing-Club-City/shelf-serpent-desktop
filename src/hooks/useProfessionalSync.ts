import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface SyncStatus {
  table_name: string;
  local_count: number;
  remote_count: number;
  unsynced_local: number;
  sync_needed: boolean;
}

interface SyncResult {
  success: boolean;
  uploaded?: number;
  downloaded?: number;
  conflicts_resolved?: number;
  total_processed?: number;
  errors?: string[];
  action?: string;
  reason?: string;
  message?: string;
}

interface ConnectivityStatus {
  connected: boolean;
  status: 'online' | 'offline';
}

interface UseProfessionalSyncReturn {
  // Status
  syncStatuses: SyncStatus[];
  connectivity: ConnectivityStatus;
  loading: boolean;
  lastSyncResult: SyncResult | null;
  autoSyncEnabled: boolean;
  
  // Computed values
  totalUnsyncedCount: number;
  syncNeeded: boolean;
  
  // Actions
  loadSyncStatus: () => Promise<void>;
  checkConnectivity: () => Promise<void>;
  uploadLocalChanges: () => Promise<void>;
  performFullSync: () => Promise<void>;
  performAutoSync: () => Promise<void>;
  testAutoSync: () => Promise<void>;
  enableAutoSync: () => Promise<void>;
  disableAutoSync: () => Promise<void>;
  loadAutoSyncStatus: () => Promise<void>;
  
  // Utils
  clearLastResult: () => void;
}

export const useProfessionalSync = (): UseProfessionalSyncReturn => {
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [connectivity, setConnectivity] = useState<ConnectivityStatus>({ 
    connected: false, 
    status: 'offline' 
  });
  const [loading, setLoading] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  // Computed values
  const totalUnsyncedCount = syncStatuses.reduce((total, status) => total + status.unsynced_local, 0);
  const syncNeeded = totalUnsyncedCount > 0;

  const loadSyncStatus = useCallback(async () => {
    try {
      const result = await invoke<any>('get_professional_sync_status');
      if (result.success) {
        setSyncStatuses(result.statuses);
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  }, []);

  const checkConnectivity = useCallback(async () => {
    try {
      const result = await invoke<ConnectivityStatus>('check_sync_connectivity');
      setConnectivity(result);
    } catch (error) {
      setConnectivity({ connected: false, status: 'offline' });
    }
  }, []);

  const uploadLocalChanges = useCallback(async () => {
    if (loading || !connectivity.connected) return;
    
    setLoading(true);
    try {
      const result = await invoke<SyncResult>('upload_local_borrowings');
      setLastSyncResult(result);
      await loadSyncStatus();
    } catch (error) {
      console.error('Upload failed:', error);
      setLastSyncResult({
        success: false,
        message: `Upload failed: ${error}`
      });
    } finally {
      setLoading(false);
    }
  }, [loading, connectivity.connected, loadSyncStatus]);

  const performFullSync = useCallback(async () => {
    if (loading || !connectivity.connected) return;
    
    setLoading(true);
    try {
      const result = await invoke<SyncResult>('fixed_comprehensive_sync');
      setLastSyncResult(result);
      await loadSyncStatus();
    } catch (error) {
      console.error('Full sync failed:', error);
      setLastSyncResult({
        success: false,
        message: `Full sync failed: ${error}`
      });
    } finally {
      setLoading(false);
    }
  }, [loading, connectivity.connected, loadSyncStatus]);

  const performAutoSync = useCallback(async () => {
    if (loading || !connectivity.connected) return;
    
    try {
      const result = await invoke<SyncResult>('auto_sync_if_needed');
      if (result.action === 'completed') {
        setLastSyncResult(result);
        await loadSyncStatus();
      }
    } catch (error) {
      console.error('Auto-sync failed:', error);
    }
  }, [loading, connectivity.connected, loadSyncStatus]);

  // Auto sync management functions
  const loadAutoSyncStatus = useCallback(async () => {
    try {
      const enabled = await invoke<boolean>('get_auto_sync_status');
      setAutoSyncEnabled(enabled);
    } catch (error) {
      console.error('Failed to load auto sync status:', error);
    }
  }, []);

  const enableAutoSync = useCallback(async () => {
    try {
      await invoke('enable_auto_sync');
      setAutoSyncEnabled(true);
    } catch (error) {
      console.error('Failed to enable auto sync:', error);
      throw error;
    }
  }, []);

  const disableAutoSync = useCallback(async () => {
    try {
      await invoke('disable_auto_sync');
      setAutoSyncEnabled(false);
    } catch (error) {
      console.error('Failed to disable auto sync:', error);
      throw error;
    }
  }, []);

  const testAutoSync = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const result = await invoke<SyncResult>('auto_sync_if_needed');
      setLastSyncResult(result);
      await loadSyncStatus();
    } catch (error) {
      console.error('Auto sync test failed:', error);
      setLastSyncResult({
        success: false,
        message: `Auto sync test failed: ${error}`
      });
    } finally {
      setLoading(false);
    }
  }, [loading, loadSyncStatus]);

  const clearLastResult = useCallback(() => {
    setLastSyncResult(null);
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    // Initial load
    loadSyncStatus();
    checkConnectivity();
    
    // Set up periodic refresh
    const interval = setInterval(() => {
      loadSyncStatus();
      checkConnectivity();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [loadSyncStatus, checkConnectivity]);

  return {
    // Status
    syncStatuses,
    connectivity,
    loading,
    lastSyncResult,
    autoSyncEnabled,
    
    // Computed values
    totalUnsyncedCount,
    syncNeeded,
    
    // Actions
    loadSyncStatus,
    checkConnectivity,
    uploadLocalChanges,
    performFullSync,
    performAutoSync,
    testAutoSync,
    enableAutoSync,
    disableAutoSync,
    loadAutoSyncStatus,
    
    // Utils
    clearLastResult,
  };
};

export default useProfessionalSync;
