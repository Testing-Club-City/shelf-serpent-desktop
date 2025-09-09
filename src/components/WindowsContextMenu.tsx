import React, { useState, useCallback, memo } from 'react';
import { 
  RefreshCw, 
  WifiOff, 
  CheckCircle,
  Upload,
  Download
} from 'lucide-react';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useProfessionalSync } from '@/hooks/useProfessionalSync';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface WindowsContextMenuProps {
  children: React.ReactNode;
  className?: string;
}

const WindowsContextMenu = memo<WindowsContextMenuProps>(({ children, className }) => {
  const { isOnline } = useConnectivity();
  const { 
    loading,
    syncNeeded,
    connectivity,
    performFullSync,
    uploadLocalChanges,
    totalUnsyncedCount
  } = useProfessionalSync();

  // Get sync status icon
  const getSyncStatusIcon = useCallback(() => {
    if (loading) return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
    if (!connectivity.connected) return <WifiOff className="h-4 w-4 text-red-500" />;
    if (syncNeeded) return <Upload className="h-4 w-4 text-yellow-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  }, [connectivity.connected, loading, syncNeeded]);

  // Get sync status text
  const getSyncStatusText = useCallback(() => {
    if (loading) return 'Syncing...';
    if (!connectivity.connected) return 'Offline - Sync unavailable';
    if (syncNeeded) return `${totalUnsyncedCount} records need sync`;
    return 'All data synced';
  }, [connectivity.connected, loading, syncNeeded, totalUnsyncedCount]);

  const handleFullSync = useCallback(async () => {
    if (loading || !connectivity.connected) return;
    try {
      await performFullSync();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }, [loading, connectivity.connected, performFullSync]);

  const handleUploadOnly = useCallback(async () => {
    if (loading || !connectivity.connected || !syncNeeded) return;
    try {
      await uploadLocalChanges();
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }, [loading, connectivity.connected, syncNeeded, uploadLocalChanges]);

  return (
    <ContextMenu>
      <ContextMenuTrigger className={className}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {/* Sync Status */}
        <div className="px-2 py-1.5 text-sm">
          <div className="flex items-center gap-2">
            {getSyncStatusIcon()}
            <span className="font-medium">Sync Status</span>
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {getSyncStatusText()}
          </div>
        </div>
        
        <ContextMenuSeparator />
        
        {/* Sync Actions */}
        {connectivity.connected && (
          <>
            <ContextMenuItem 
              onClick={handleFullSync}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Full Sync
            </ContextMenuItem>
            
            {syncNeeded && (
              <ContextMenuItem 
                onClick={handleUploadOnly}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload Changes ({totalUnsyncedCount})
              </ContextMenuItem>
            )}
            
            <ContextMenuSeparator />
          </>
        )}
        
        {/* Connection Status */}
        <div className="px-2 py-1.5 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                <span>Offline Mode</span>
              </>
            )}
          </div>
        </div>
      </ContextMenuContent>
    </ContextMenu>
  );
});

WindowsContextMenu.displayName = 'WindowsContextMenu';

export default WindowsContextMenu;
