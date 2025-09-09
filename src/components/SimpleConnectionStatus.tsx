import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConnectivity } from '@/hooks/useConnectivity';

interface SimpleConnectionStatusProps {
  className?: string;
  showRefresh?: boolean;
}

export function SimpleConnectionStatus({ className, showRefresh = true }: SimpleConnectionStatusProps) {
  const { isOnline, isLoading, refresh } = useConnectivity();

  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    
    if (isOnline) {
      return <Wifi className="h-4 w-4 text-green-500" />;
    }
    
    return <WifiOff className="h-4 w-4 text-red-500" />;
  };

  const getStatusText = () => {
    if (isLoading) return 'Checking...';
    if (isOnline) return 'Online';
    return 'Offline';
  };

  return (
    <div className={cn("flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 bg-white rounded-lg border shadow-sm", className)}>
      <div className="flex items-center gap-2">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={cn(
            "text-sm font-medium",
            isOnline ? "text-green-600" : "text-red-600"
          )}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        
        {!isOnline && (
          <span className="text-xs text-muted-foreground">(Browser mode)</span>
        )}
      </div>
      
      {showRefresh && (
        <div className="flex gap-2 mt-2 sm:mt-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isLoading && "animate-spin")} />
            {isLoading ? 'Checking...' : 'Refresh'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default SimpleConnectionStatus;
