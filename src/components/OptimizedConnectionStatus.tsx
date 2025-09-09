import React, { useState, useEffect } from 'react';
import { useOptimizedConnectivity } from '../hooks/useOptimizedConnectivity';
import { useSmartSync } from '../hooks/useSmartSync';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface OptimizedConnectionStatusProps {
  showDetails?: boolean;
  onModeChange?: (isOnline: boolean) => void;
}

export const OptimizedConnectionStatus: React.FC<OptimizedConnectionStatusProps> = ({
  showDetails = false,
  onModeChange
}) => {
  const connectivity = useOptimizedConnectivity();
  const smartSync = useSmartSync();
  const [lastModeChange, setLastModeChange] = useState<Date | null>(null);

  // Handle mode changes
  useEffect(() => {
    if (onModeChange) {
      onModeChange(connectivity.isOnline);
    }
    
    if (connectivity.isOnline !== (lastModeChange !== null)) {
      setLastModeChange(new Date());
      
      // Trigger smart sync on connection restore
      if (connectivity.isOnline && !connectivity.isTransitioning) {
        setTimeout(() => {
          smartSync.backgroundSync();
        }, 1000);
      }
    }
  }, [connectivity.isOnline, connectivity.isTransitioning, onModeChange, smartSync, lastModeChange]);

  const getStatusIcon = () => {
    if (connectivity.isTransitioning) {
      return <RefreshCw className="w-4 h-4 animate-spin text-yellow-500" />;
    }
    
    if (!connectivity.isOnline) {
      return <WifiOff className="w-4 h-4 text-red-500" />;
    }
    
    switch (connectivity.connectionQuality) {
      case 'excellent':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'good':
        return <Wifi className="w-4 h-4 text-blue-500" />;
      case 'poor':
        return <Wifi className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    if (connectivity.isTransitioning) {
      return 'Switching...';
    }
    
    if (!connectivity.isOnline) {
      return 'Offline Mode';
    }
    
    return `Online (${connectivity.connectionQuality})`;
  };

  const getStatusColor = () => {
    if (connectivity.isTransitioning) {
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
    
    if (!connectivity.isOnline) {
      return 'text-red-600 bg-red-50 border-red-200';
    }
    
    switch (connectivity.connectionQuality) {
      case 'excellent':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'good':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'poor':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSyncStatusIcon = () => {
    if (smartSync.isSyncing) {
      return <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />;
    }
    
    if (smartSync.error) {
      return <AlertCircle className="w-3 h-3 text-red-500" />;
    }
    
    if (smartSync.lastSync) {
      return <CheckCircle className="w-3 h-3 text-green-500" />;
    }
    
    return <Clock className="w-3 h-3 text-gray-400" />;
  };

  const formatLastSync = () => {
    if (!smartSync.lastSync) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - smartSync.lastSync.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return smartSync.lastSync.toLocaleDateString();
  };

  return (
    <div className="flex items-center space-x-2">
      {/* Main Status Indicator */}
      <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-all duration-200 ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="text-sm font-medium">
          {getStatusText()}
        </span>
        
        {connectivity.isTransitioning && (
          <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
        )}
      </div>

      {/* Sync Status */}
      {showDetails && (
        <div className="flex items-center space-x-1 text-xs text-gray-500">
          {getSyncStatusIcon()}
          <span>
            {smartSync.isSyncing ? (
              `Syncing... ${smartSync.syncProgress}%`
            ) : (
              `Last sync: ${formatLastSync()}`
            )}
          </span>
          
          {smartSync.pendingChanges > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-xs">
              {smartSync.pendingChanges} pending
            </span>
          )}
        </div>
      )}

      {/* Manual Refresh Button */}
      <button
        onClick={() => connectivity.refresh()}
        disabled={connectivity.isTransitioning}
        className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        title="Refresh connection status"
      >
        <RefreshCw className={`w-4 h-4 ${connectivity.isTransitioning ? 'animate-spin' : ''}`} />
      </button>

      {/* Error Display */}
      {connectivity.error && (
        <div className="text-xs text-red-500 max-w-xs truncate" title={connectivity.error}>
          {connectivity.error}
        </div>
      )}
    </div>
  );
};

export default OptimizedConnectionStatus;