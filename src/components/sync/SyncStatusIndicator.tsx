import React from 'react';
import { 
  Wifi, 
  WifiOff, 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw,
  Clock
} from 'lucide-react';
import { useProfessionalSync } from '../../hooks/useProfessionalSync';

interface SyncStatusIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ 
  showDetails = false, 
  className = '' 
}) => {
  const {
    connectivity,
    totalUnsyncedCount,
    syncNeeded,
    loading,
    lastSyncResult,
    uploadLocalChanges,
    performFullSync
  } = useProfessionalSync();

  const getStatusColor = () => {
    if (!connectivity.connected) return 'text-red-500';
    if (syncNeeded) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (loading) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (!connectivity.connected) return <WifiOff className="h-4 w-4" />;
    if (syncNeeded) return <Upload className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (loading) return 'Syncing...';
    if (!connectivity.connected) return 'Offline';
    if (syncNeeded) return `${totalUnsyncedCount} unsynced`;
    return 'Synced';
  };

  if (!showDetails) {
    // Compact indicator
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`${getStatusColor()}`}>
          {getStatusIcon()}
        </div>
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>
    );
  }

  // Detailed indicator with actions
  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`${getStatusColor()}`}>
            {getStatusIcon()}
          </div>
          <div>
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
            <div className="text-xs text-gray-500">
              {connectivity.connected ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>

        {connectivity.connected && syncNeeded && !loading && (
          <div className="flex space-x-2">
            <button
              onClick={uploadLocalChanges}
              className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Upload className="h-3 w-3" />
              <span>Upload</span>
            </button>
            <button
              onClick={performFullSync}
              className="flex items-center space-x-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Sync</span>
            </button>
          </div>
        )}
      </div>

      {/* Last sync result */}
      {lastSyncResult && (
        <div className={`text-xs p-2 rounded ${
          lastSyncResult.success 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <div className="flex items-center space-x-1">
            {lastSyncResult.success ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            <span className="font-medium">
              {lastSyncResult.success ? 'Last sync successful' : 'Last sync failed'}
            </span>
          </div>
          
          {lastSyncResult.message && (
            <p className="mt-1 truncate">{lastSyncResult.message}</p>
          )}
          
          {lastSyncResult.success && (lastSyncResult.uploaded || lastSyncResult.downloaded) && (
            <div className="flex space-x-3 mt-1">
              {lastSyncResult.uploaded !== undefined && (
                <span>↑ {lastSyncResult.uploaded}</span>
              )}
              {lastSyncResult.downloaded !== undefined && (
                <span>↓ {lastSyncResult.downloaded}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Offline notice */}
      {!connectivity.connected && (
        <div className="flex items-center space-x-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
          <Clock className="h-3 w-3" />
          <span>Changes will sync when online</span>
        </div>
      )}
    </div>
  );
};

export default SyncStatusIndicator;
