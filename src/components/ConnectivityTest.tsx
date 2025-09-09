import React from 'react';
import { useConnectivity } from '@/hooks/useConnectivity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

export const ConnectivityTest: React.FC = () => {
  const {
    isOnline,
    isLoading,
    error,
    lastCheck,
    connectionQuality,
    refresh,
    getConnectionStatusText,
  } = useConnectivity();

  const getQualityColor = (quality: any) => {
    switch (quality) {
      case 'excellent':
        return 'bg-green-500';
      case 'good':
        return 'bg-yellow-500';
      case 'poor':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Connectivity Status</CardTitle>
        <div className="flex items-center space-x-2">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-green-600" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-600" />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold">
              {getConnectionStatusText()}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? 'Checking connection...' : 'Current status'}
            </p>
          </div>

          {connectionQuality !== 'unknown' && (
            <div className="flex items-center space-x-2">
              <Badge 
                variant="secondary" 
                className={`${getQualityColor(connectionQuality as 'excellent' | 'good' | 'poor' | 'unknown')} text-white`}
              >
                {connectionQuality.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Connection Quality
              </span>
            </div>
          )}

          {error && (
            <div className="p-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm rounded">
              Error: {error}
            </div>
          )}

          {lastCheck && (
            <div className="text-xs text-muted-foreground">
              Last checked: {lastCheck.toLocaleTimeString()}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="font-semibold">Online:</span>{' '}
              <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
                {isOnline ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <span className="font-semibold">Loading:</span>{' '}
              <span className={isLoading ? 'text-blue-600' : 'text-gray-600'}>
                {isLoading ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConnectivityTest;
