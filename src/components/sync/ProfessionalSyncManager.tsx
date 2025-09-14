import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useQueryClient } from '@tanstack/react-query';
import { 
  RefreshCw, 
  Upload, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Wifi, 
  WifiOff,
  Clock,
  Database,
  Zap
} from 'lucide-react';

interface SyncStatus {
  table_name: string;
  display_name?: string;
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
  tables_synced?: number;
  errors?: string[];
  action?: string;
  reason?: string;
  message?: string;
}

interface ConnectivityStatus {
  connected: boolean;
  status: 'online' | 'offline';
}

const ProfessionalSyncManager: React.FC = () => {
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [connectivity, setConnectivity] = useState<ConnectivityStatus>({ connected: false, status: 'offline' });
  const [loading, setLoading] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  
  // Query client for refreshing data
  const queryClient = useQueryClient();

  // Load initial data
  useEffect(() => {
    loadSyncStatus();
    loadAutoSyncStatus();
  }, []);

  // Load auto sync status from backend
  const loadAutoSyncStatus = async () => {
    try {
      const enabled = await invoke<boolean>('get_auto_sync_status');
      setAutoSyncEnabled(enabled);
    } catch (error) {
      console.error('Failed to load auto sync status:', error);
    }
  };

  // Handle auto sync toggle
  const handleAutoSyncToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        await invoke('enable_auto_sync');
        console.log('✅ Auto-sync enabled');
      } else {
        await invoke('disable_auto_sync');
        console.log('⏸️ Auto-sync disabled');
      }
      setAutoSyncEnabled(enabled);
    } catch (error) {
      console.error('Failed to toggle auto sync:', error);
      // Revert the toggle on error
      setAutoSyncEnabled(!enabled);
    }
  };

  // Handle test auto sync
  const handleTestAutoSync = async () => {
    setLoading(true);
    try {
      const result = await invoke<SyncResult>('run_multithreaded_bidirectional_sync');
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
  };

  // Load initial data and set up periodic sync
  useEffect(() => {
    loadSyncStatus();
    loadAutoSyncStatus();
    checkConnectivity();
    
    // Set up auto-refresh
    const interval = setInterval(() => {
      loadSyncStatus();
      checkConnectivity();
      
      if (autoSyncEnabled) {
        performAutoSync();
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [autoSyncEnabled]);

  const loadSyncStatus = async () => {
    try {
      const result = await invoke<any>('get_professional_sync_status');
      if (result.success) {
        setSyncStatuses(result.statuses);
      }
      
      // Also refresh all the core data that affects the borrowing system
      console.log('🔄 Refreshing system data...');
      
      // Invalidate all the key data queries to force refresh
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['books', 'offline-first'] }),
        queryClient.invalidateQueries({ queryKey: ['students', 'offline-first'] }),
        queryClient.invalidateQueries({ queryKey: ['borrowings', 'offline-first'] }),
        queryClient.invalidateQueries({ queryKey: ['staff', 'offline-first'] }),
        queryClient.invalidateQueries({ queryKey: ['categories', 'offline-first'] }),
        queryClient.invalidateQueries({ queryKey: ['classes', 'offline-first'] }),
        queryClient.invalidateQueries({ queryKey: ['group-borrowings', 'offline-first'] }),
        queryClient.invalidateQueries({ queryKey: ['fines', 'offline-first'] })
      ]);
      
      console.log('✅ System data refreshed successfully');
      
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const checkConnectivity = async () => {
    try {
      const result = await invoke<ConnectivityStatus>('check_sync_connectivity');
      setConnectivity(result);
    } catch (error) {
      setConnectivity({ connected: false, status: 'offline' });
    }
  };

  const performAutoSync = async () => {
    if (loading) return;
    
    try {
      const result = await invoke<SyncResult>('run_multithreaded_bidirectional_sync');
      setLastSyncResult(result);
      await loadSyncStatus();
    } catch (error) {
      console.error('Auto-sync failed:', error);
    }
  };

  const handleUploadLocal = async () => {
    setLoading(true);
    try {
      const result = await invoke<SyncResult>('upload_local_changes');
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
  };

  const handleFullSync = async () => {
    setLoading(true);
    try {
      const result = await invoke<SyncResult>('run_multithreaded_bidirectional_sync');
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
  };

  const getTotalUnsyncedCount = () => {
    return syncStatuses.reduce((total, status) => total + status.unsynced_local, 0);
  };

  const getSyncStatusColor = (status: SyncStatus) => {
    if (status.unsynced_local === 0) return 'text-green-600';
    if (status.unsynced_local < 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Database className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Professional Sync Manager</h2>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Connectivity Status */}
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
            connectivity.connected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {connectivity.connected ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            <span>{connectivity.status.toUpperCase()}</span>
          </div>

          {/* Auto-sync Toggle */}
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              onChange={(e) => handleAutoSyncToggle(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Auto-sync {autoSyncEnabled ? '(ON)' : '(OFF)'}
            </span>
          </label>
        </div>
      </div>

      {/* Sync Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        {syncStatuses.map((status) => (
          <div key={status.table_name} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900 text-sm">
                {status.display_name || status.table_name}
              </h3>
              {status.sync_needed ? (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
            </div>
            
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Local:</span>
                <span className="font-medium">{status.local_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Remote:</span>
                <span className="font-medium">{status.remote_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Unsynced:</span>
                <span className={`font-medium ${getSyncStatusColor(status)}`}>
                  {status.unsynced_local}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={handleUploadLocal}
          disabled={loading || !connectivity.connected || getTotalUnsyncedCount() === 0}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Upload className="h-4 w-4" />
          <span>Upload Local Changes</span>
          {getTotalUnsyncedCount() > 0 && (
            <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
              {getTotalUnsyncedCount()}
            </span>
          )}
        </button>

        <button
          onClick={handleFullSync}
          disabled={loading || !connectivity.connected}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Lock-Free Sync</span>
        </button>

        <button
          onClick={handleTestAutoSync}
          disabled={loading}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            autoSyncEnabled 
              ? 'bg-purple-600 text-white hover:bg-purple-700' 
              : 'bg-gray-400 text-gray-200 cursor-not-allowed'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Clock className="h-4 w-4" />
          <span>Test Auto Sync</span>
          {!autoSyncEnabled && <span className="text-xs">(Disabled)</span>}
        </button>

        <button
          onClick={async () => {
            setLoading(true);
            try {
              const result = await invoke<string>('sync_remaining_book_copies');
              setLastSyncResult({
                success: true,
                message: result
              });
              // Don't call loadSyncStatus() to avoid triggering other syncs
            } catch (error) {
              console.error('Sync remaining book copies failed:', error);
              setLastSyncResult({
                success: false,
                message: `Sync remaining book copies failed: ${error}`
              });
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading || !connectivity.connected}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>Sync Missing Book Copies</span>
        </button>

        <button
          onClick={async () => {
            setLoading(true);
            try {
              const result = await invoke<SyncResult>('pull_all_database');
              setLastSyncResult(result);
              await loadSyncStatus();
            } catch (error) {
              console.error('Pull all database failed:', error);
              setLastSyncResult({
                success: false,
                message: `Pull all database failed: ${error}`
              });
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading || !connectivity.connected}
          className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>Pull All Database</span>
        </button>

        <button
          onClick={loadSyncStatus}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Zap className="h-4 w-4" />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Last Sync Result */}
      {lastSyncResult && (
        <div className={`rounded-lg p-4 mb-4 ${
          lastSyncResult.success 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start space-x-3">
            {lastSyncResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            )}
            
            <div className="flex-1">
              <h4 className={`font-medium ${
                lastSyncResult.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {lastSyncResult.success ? 'Sync Completed Successfully' : 'Sync Failed'}
              </h4>
              
              {lastSyncResult.message && (
                <p className={`text-sm mt-1 ${
                  lastSyncResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {lastSyncResult.message}
                </p>
              )}
              
              {lastSyncResult.success && (lastSyncResult.uploaded || lastSyncResult.downloaded) && (
                <div className="flex flex-wrap gap-4 mt-2 text-sm">
                  {lastSyncResult.uploaded !== undefined && (
                    <div className="flex items-center space-x-1">
                      <Upload className="h-3 w-3" />
                      <span>Uploaded: {lastSyncResult.uploaded}</span>
                    </div>
                  )}
                  {lastSyncResult.downloaded !== undefined && (
                    <div className="flex items-center space-x-1">
                      <Download className="h-3 w-3" />
                      <span>Downloaded: {lastSyncResult.downloaded}</span>
                    </div>
                  )}
                  {lastSyncResult.tables_synced !== undefined && (
                    <div className="flex items-center space-x-1">
                      <Database className="h-3 w-3" />
                      <span>Tables: {lastSyncResult.tables_synced}</span>
                    </div>
                  )}
                  {lastSyncResult.conflicts_resolved !== undefined && lastSyncResult.conflicts_resolved > 0 && (
                    <div className="flex items-center space-x-1">
                      <AlertCircle className="h-3 w-3" />
                      <span>Conflicts resolved: {lastSyncResult.conflicts_resolved}</span>
                    </div>
                  )}
                </div>
              )}
              
              {lastSyncResult.errors && lastSyncResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-red-700">Errors:</p>
                  <ul className="text-sm text-red-600 mt-1 space-y-1">
                    {lastSyncResult.errors.slice(0, 3).map((error, index) => (
                      <li key={index} className="truncate">• {error}</li>
                    ))}
                    {lastSyncResult.errors.length > 3 && (
                      <li className="text-red-500">... and {lastSyncResult.errors.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
        <div className="flex items-start space-x-2">
          <Clock className="h-4 w-4 mt-0.5 text-blue-600" />
          <div>
            <p className="font-medium">Lock-Free Multithreaded Sync:</p>
            <ul className="mt-1 space-y-1 text-blue-700">
              <li>• <strong>Lock-Free Sync:</strong> Uses queue-based approach to prevent database locks</li>
              <li>• <strong>Single Writer:</strong> Only one thread writes to database at a time</li>
              <li>• <strong>Large Batches:</strong> Processes 1000 records at a time for efficiency</li>
              <li>• <strong>Network Limiting:</strong> Max 2 concurrent downloads to avoid overload</li>
              <li>• <strong>No Database Locks:</strong> Eliminates "database is locked" errors</li>
              <li>• <strong>Background Processing:</strong> Sync runs without blocking the UI</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalSyncManager;
