import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wifi, 
  WifiOff, 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Database,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  HardDrive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';

interface ConnectionStatusData {
  is_online: boolean;
  is_syncing: boolean;
  last_sync?: string;
  pending_operations: number;
  initial_sync_completed: boolean;
  database_initialized: boolean;
}

interface LocalDataCount {
  books_count: number;
  students_count: number;
  categories_count: number;
  has_data: boolean;
}

interface ConnectionStatusProps {
  className?: string;
  showDetails?: boolean;
}

export function ConnectionStatus({ className, showDetails = true }: ConnectionStatusProps) {
  const [status, setStatus] = useState<ConnectionStatusData>({
    is_online: false,
    is_syncing: false,
    pending_operations: 0,
    initial_sync_completed: false,
    database_initialized: true,
  });
  const [localData, setLocalData] = useState<LocalDataCount>({
    books_count: 0,
    students_count: 0,
    categories_count: 0,
    has_data: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadStatus = async () => {
    try {
      const [statusData, dataCount] = await Promise.all([
        invoke<ConnectionStatusData>('get_connection_status'),
        invoke<LocalDataCount>('check_local_data_count')
      ]);
      setStatus(statusData);
      setLocalData(dataCount);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load connection status:', error);
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      await invoke('initial_data_pull');
      loadStatus(); // Refresh status after sync
    } catch (error) {
      console.error('Failed to trigger sync:', error);
    }
  };

  const handleCheckConnectivity = async () => {
    try {
      setIsLoading(true);
      await invoke('force_connectivity_refresh');
      await loadStatus(); // Refresh status after connectivity check
    } catch (error) {
      console.error('Failed to check connectivity:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    
    // Poll for status updates more frequently (every 3 seconds)
    const interval = setInterval(loadStatus, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    
    if (status.is_syncing) {
      return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
    }
    
    if (status.is_online) {
      return <Wifi className="h-4 w-4 text-green-500" />;
    }
    
    return <WifiOff className="h-4 w-4 text-red-500" />;
  };

  const getStatusText = () => {
    if (isLoading) return 'Loading...';
    if (status.is_syncing) return 'Pulling Data...';
    if (status.is_online) return 'Online';
    return 'Offline';
  };

  const getStatusVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    if (status.is_syncing) return 'default';
    if (status.is_online) return 'default';
    return 'destructive';
  };

  const getStatusClassName = () => {
    if (status.is_syncing) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (status.is_online) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  if (!showDetails) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border",
          getStatusClassName()
        )}>
          {getStatusIcon()}
          {getStatusText()}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Main Status */}
      <div className="flex items-center justify-between">
        <div className={cn(
          "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border",
          getStatusClassName()
        )}>
          {getStatusIcon()}
          {getStatusText()}
        </div>
        
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCheckConnectivity}
            disabled={isLoading}
            title="Check connectivity"
          >
            <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
          </Button>
          
          {status.is_online && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSync}
              disabled={status.is_syncing}
              title="Pull data"
            >
              <Download className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Detailed Status */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Database Status */}
        <div className="flex items-center gap-1">
          <Database className="h-3 w-3" />
          <span className={cn(
            status.database_initialized ? "text-green-600" : "text-red-600"
          )}>
            {status.database_initialized ? "Ready" : "Not Ready"}
          </span>
        </div>

        {/* Sync Status */}
        <div className="flex items-center gap-1">
          <Cloud className="h-3 w-3" />
          <span className={cn(
            status.initial_sync_completed ? "text-green-600" : "text-yellow-600"
          )}>
            {status.initial_sync_completed ? "Synced" : "Not Synced"}
          </span>
        </div>

        {/* Pending Operations */}
        {status.pending_operations > 0 && (
          <div className="flex items-center gap-1 col-span-2">
            <Upload className="h-3 w-3 text-orange-500" />
            <span className="text-orange-600">
              {status.pending_operations} pending
            </span>
          </div>
        )}

        {/* Data Count */}
        {localData.has_data && (
          <div className="flex items-center gap-1 col-span-2">
            <HardDrive className="h-3 w-3 text-blue-500" />
            <span className="text-blue-600">
              {localData.books_count} books, {localData.students_count} students, {localData.categories_count} categories
            </span>
          </div>
        )}

        {/* Last Sync */}
        {status.last_sync && (
          <div className="flex items-center gap-1 col-span-2">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span className="text-muted-foreground">
              Last sync: {new Date(status.last_sync).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Offline Mode Notice */}
      {!status.is_online && localData.has_data && (
        <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 p-2 rounded border">
          <CheckCircle className="h-3 w-3" />
          <span>Working offline with previously synced data ({localData.books_count + localData.students_count + localData.categories_count} records).</span>
        </div>
      )}

      {/* No Data Offline */}
      {!status.is_online && !localData.has_data && (
        <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 p-2 rounded border">
          <AlertCircle className="h-3 w-3" />
          <span>No data available offline. Connect to internet to pull data from server.</span>
        </div>
      )}

      {/* Initial Data Pull Required */}
      {status.is_online && !status.initial_sync_completed && !localData.has_data && (
        <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 p-2 rounded border">
          <Download className="h-3 w-3" />
          <span>Click the pull button to download your library data from the server.</span>
        </div>
      )}
    </div>
  );
}

export default ConnectionStatus;
