import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Database, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Settings,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  Clock,
  CloudDownload
} from 'lucide-react';
import { useProfessionalSync } from '@/hooks/useProfessionalSync';
import { useConnectivity } from '@/hooks/useConnectivity';
import { ProfessionalSyncPanel } from './ProfessionalSyncPanel';
import { cn } from '@/lib/utils';

export const SyncActionBar: React.FC = () => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { syncProgress, issyncing, syncAll, pullAllDatabase } = useProfessionalSync();
  const { isOnline } = useConnectivity();

  const getSyncStatusColor = () => {
    if (issyncing) return 'bg-blue-500';
    if (!isOnline) return 'bg-red-500';
    if (syncProgress.errors.length > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getSyncStatusIcon = () => {
    if (issyncing) return <RefreshCw className="h-3 w-3 animate-spin" />;
    if (!isOnline) return <WifiOff className="h-3 w-3" />;
    if (syncProgress.errors.length > 0) return <AlertTriangle className="h-3 w-3" />;
    return <CheckCircle className="h-3 w-3" />;
  };

  const getLastSyncText = () => {
    if (!syncProgress.lastSync) return 'Never synced';
    const date = new Date(syncProgress.lastSync);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const handleQuickSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!issyncing && isOnline) {
      syncAll();
    }
  };

  const handlePullAllDatabase = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!issyncing && isOnline) {
      pullAllDatabase();
    }
  };

  return (
    <TooltipProvider>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t">
        {/* Action Bar */}
        <div className="px-4 py-2 flex items-center justify-between">
          {/* Left section - Sync Status */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className={cn("w-2 h-2 rounded-full", getSyncStatusColor())} />
              <span className="text-sm font-medium">
                {issyncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            
            {syncProgress.lastSync && (
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{getLastSyncText()}</span>
              </div>
            )}

            {issyncing && (
              <Badge variant="secondary" className="text-xs">
                {syncProgress.progress}/{syncProgress.total}
              </Badge>
            )}
          </div>

          {/* Center section - Quick Actions */}
          <div className="flex items-center space-x-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleQuickSync}
                  disabled={!isOnline || issyncing}
                  className="h-8 px-3"
                >
                  <RefreshCw className={cn("h-4 w-4", issyncing && "animate-spin")} />
                  <span className="ml-1 hidden sm:inline">Quick Sync</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Quick synchronization of all data</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePullAllDatabase}
                  disabled={!isOnline || issyncing}
                  className="h-8 px-3 bg-blue-600 hover:bg-blue-700"
                >
                  <CloudDownload className={cn("h-4 w-4", issyncing && "animate-spin")} />
                  <span className="ml-1 hidden sm:inline">Pull DB</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>🚀 Pull complete database from server (all tables)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3"
                >
                  {isOnline ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-500" />
                  )}
                  <span className="ml-1 hidden sm:inline">
                    {isOnline ? 'Connected' : 'Offline'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Network connection status</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Right section - Panel Controls */}
          <div className="flex items-center space-x-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3"
                >
                  <Settings className="h-4 w-4" />
                  <span className="ml-1 hidden sm:inline">Settings</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sync configuration settings</p>
              </TooltipContent>
            </Tooltip>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className="h-8 px-3 bg-background"
            >
              <Database className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Sync Panel</span>
              <ChevronUp 
                className={cn(
                  "h-3 w-3 ml-1 transition-transform",
                  isPanelOpen && "rotate-180"
                )} 
              />
            </Button>
          </div>
        </div>

        {/* Sync Progress Bar */}
        {issyncing && (
          <div className="px-4 pb-2">
            <div className="w-full bg-secondary h-1 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ 
                  width: `${(syncProgress.progress / syncProgress.total) * 100}%` 
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{syncProgress.currentTask}</span>
              <span>{Math.round((syncProgress.progress / syncProgress.total) * 100)}%</span>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {syncProgress.errors.length > 0 && !issyncing && (
          <div className="px-4 pb-2">
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-2">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-800 dark:text-yellow-200">
                  Sync completed with {syncProgress.errors.length} error(s)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPanelOpen(true)}
                  className="ml-auto h-6 text-xs"
                >
                  View Details
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Professional Sync Panel */}
        <ProfessionalSyncPanel 
          isOpen={isPanelOpen} 
          onClose={() => {
            console.log('SyncActionBar: Closing panel, current state:', isPanelOpen);
            setIsPanelOpen(false);
          }} 
        />
      </div>
    </TooltipProvider>
  );
};
