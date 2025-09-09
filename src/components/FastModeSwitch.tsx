import React, { useEffect, useState } from 'react';
import { useOptimizedConnectivity } from '../hooks/useOptimizedConnectivity';
import { useSmartSync } from '../hooks/useSmartSync';
import { invoke } from '@tauri-apps/api/core';
import { Wifi, WifiOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface FastModeSwitchProps {
  onModeChange?: (isOnline: boolean, isTransitioning: boolean) => void;
}

export const FastModeSwitch: React.FC<FastModeSwitchProps> = ({ onModeChange }) => {
  const connectivity = useOptimizedConnectivity();
  const smartSync = useSmartSync();
  const [transitionStartTime, setTransitionStartTime] = useState<number | null>(null);
  const [transitionDuration, setTransitionDuration] = useState<number | null>(null);

  // Track mode transitions
  useEffect(() => {
    if (connectivity.isTransitioning && !transitionStartTime) {
      setTransitionStartTime(Date.now());
      setTransitionDuration(null);
    } else if (!connectivity.isTransitioning && transitionStartTime) {
      const duration = Date.now() - transitionStartTime;
      setTransitionDuration(duration);
      setTransitionStartTime(null);
      
      // Clear duration after 3 seconds
      setTimeout(() => setTransitionDuration(null), 3000);
    }
  }, [connectivity.isTransitioning, transitionStartTime]);

  // Notify parent of mode changes
  useEffect(() => {
    if (onModeChange) {
      onModeChange(connectivity.isOnline, connectivity.isTransitioning);
    }
  }, [connectivity.isOnline, connectivity.isTransitioning, onModeChange]);

  // Handle manual sync trigger
  const handleManualSync = async () => {
    if (!connectivity.isOnline || smartSync.isSyncing) return;
    
    try {
      await smartSync.prioritySync();
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };

  // Handle connectivity refresh
  const handleRefresh = async () => {
    try {
      // Clear cache for fresh check
      await invoke('clear_connectivity_cache');
      connectivity.refresh();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  };

  const getStatusColor = () => {
    if (connectivity.isTransitioning) return 'bg-yellow-500';
    if (!connectivity.isOnline) return 'bg-red-500';
    
    switch (connectivity.connectionQuality) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'poor': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    if (connectivity.isTransitioning) {
      const elapsed = transitionStartTime ? Date.now() - transitionStartTime : 0;
      return `Switching... (${Math.round(elapsed / 100) / 10}s)`;
    }
    
    if (!connectivity.isOnline) return 'Offline Mode';
    return `Online (${connectivity.connectionQuality})`;
  };

  return (
    <div className="flex items-center space-x-3 p-3 bg-white rounded-lg shadow-sm border">
      {/* Status Indicator */}
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${getStatusColor()} transition-colors duration-200`}>
          {connectivity.isTransitioning && (
            <div className="w-3 h-3 rounded-full bg-current animate-pulse" />
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          {connectivity.isTransitioning ? (
            <Loader2 className="w-4 h-4 animate-spin text-yellow-600" />
          ) : connectivity.isOnline ? (
            <Wifi className="w-4 h-4 text-green-600" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-600" />
          )}
          
          <span className="text-sm font-medium text-gray-700">
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Transition Performance */}
      {transitionDuration && (
        <div className="flex items-center space-x-1 text-xs text-green-600">
          <CheckCircle className="w-3 h-3" />
          <span>Switched in {transitionDuration}ms</span>
        </div>
      )}

      {/* Sync Status */}
      {connectivity.isOnline && (
        <div className="flex items-center space-x-2">
          {smartSync.isSyncing ? (
            <div className="flex items-center space-x-1 text-xs text-blue-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Syncing {smartSync.syncProgress}%</span>
            </div>
          ) : smartSync.pendingChanges > 0 ? (
            <button
              onClick={handleManualSync}
              className="flex items-center space-x-1 text-xs text-orange-600 hover:text-orange-700 transition-colors"
            >
              <AlertCircle className="w-3 h-3" />
              <span>{smartSync.pendingChanges} pending</span>
            </button>
          ) : (
            <div className="flex items-center space-x-1 text-xs text-green-600">
              <CheckCircle className="w-3 h-3" />
              <span>Synced</span>
            </div>
          )}
        </div>
      )}

      {/* Manual Controls */}
      <div className="flex items-center space-x-1">
        <button
          onClick={handleRefresh}
          disabled={connectivity.isTransitioning}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          title="Refresh connection"
        >
          <Loader2 className={`w-3 h-3 ${connectivity.isTransitioning ? 'animate-spin' : ''}`} />
        </button>
        
        {connectivity.isOnline && !smartSync.isSyncing && (
          <button
            onClick={handleManualSync}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Manual sync"
          >
            <CheckCircle className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Error Display */}
      {connectivity.error && (
        <div className="text-xs text-red-500 max-w-xs truncate" title={connectivity.error}>
          {connectivity.error}
        </div>
      )}
    </div>
  );
};

export default FastModeSwitch;