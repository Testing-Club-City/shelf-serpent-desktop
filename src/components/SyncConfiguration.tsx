import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Database, 
  Cloud, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Download,
  Upload,
  HardDrive
} from 'lucide-react';
import { setupSync, startSync, forceSync, getSyncStatus, isOnline, SyncStatus } from '@/lib/api';

export function SyncConfiguration() {
  const [config, setConfig] = useState({
    supabaseUrl: '',
    supabaseAnonKey: '',
    serviceRoleKey: '',
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load sync status on component mount and poll for updates
  useEffect(() => {
    loadSyncStatus();
    checkOnlineStatus();
    
    const interval = setInterval(() => {
      loadSyncStatus();
      checkOnlineStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await getSyncStatus();
      setSyncStatus(status);
    } catch (err) {
      console.error('Failed to load sync status:', err);
    }
  };

  const checkOnlineStatus = async () => {
    try {
      const status = await isOnline();
      setOnline(status);
    } catch (err) {
      console.error('Failed to check online status:', err);
    }
  };

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      setError('Please fill in all required fields');
      return;
    }

    setIsConfiguring(true);
    setError(null);
    setSuccess(null);

    try {
      await setupSync(
        config.supabaseUrl,
        config.supabaseAnonKey,
        config.serviceRoleKey || undefined
      );
      
      await startSync();
      setSuccess('Sync configuration saved and started successfully!');
      loadSyncStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure sync');
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      await forceSync();
      setSuccess('Sync completed successfully!');
      loadSyncStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (lastSync?: string) => {
    if (!lastSync) return 'Never';
    const date = new Date(lastSync);
    return date.toLocaleString();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Sync Configuration</h1>
      </div>

      {/* Online Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {online ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={online ? "default" : "destructive"}>
                {online ? "Online" : "Offline"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {online ? "Connected to Supabase" : "Working in offline mode"}
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={checkOnlineStatus}
              disabled={isConfiguring || isSyncing}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync Status */}
      {syncStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Sync Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {syncStatus.pending_operations}
                </div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center">
                  {syncStatus.is_syncing ? (
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                  ) : (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {syncStatus.is_syncing ? 'Syncing' : 'Idle'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium">
                  {formatLastSync(syncStatus.last_sync)}
                </div>
                <div className="text-sm text-muted-foreground">Last Sync</div>
              </div>
              <div className="text-center">
                <Button 
                  onClick={handleForceSync}
                  disabled={isSyncing || !online}
                  size="sm"
                >
                  {isSyncing ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Force Sync
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Supabase Configuration
          </CardTitle>
          <CardDescription>
            Configure your Supabase connection for real-time synchronization between devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConfigSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supabase-url">Supabase URL *</Label>
              <Input
                id="supabase-url"
                type="url"
                placeholder="https://your-project.supabase.co"
                value={config.supabaseUrl}
                onChange={(e) => setConfig(prev => ({ ...prev, supabaseUrl: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="anon-key">Anonymous Key *</Label>
              <Input
                id="anon-key"
                type="text"
                placeholder="Your Supabase anonymous key"
                value={config.supabaseAnonKey}
                onChange={(e) => setConfig(prev => ({ ...prev, supabaseAnonKey: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-key">Service Role Key (Optional)</Label>
              <Input
                id="service-key"
                type="text"
                placeholder="Your Supabase service role key (for admin operations)"
                value={config.serviceRoleKey}
                onChange={(e) => setConfig(prev => ({ ...prev, serviceRoleKey: e.target.value }))}
              />
              <p className="text-sm text-muted-foreground">
                Only needed for administrative operations like bulk imports
              </p>
            </div>

            <Separator />

            <div className="flex gap-4">
              <Button 
                type="submit" 
                disabled={isConfiguring}
                className="flex-1"
              >
                {isConfiguring ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                {isConfiguring ? 'Configuring...' : 'Save & Start Sync'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Sync Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            How Sync Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Upload className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-semibold">Local-First Operation</h4>
                <p className="text-sm text-muted-foreground">
                  All data is stored locally first, ensuring the app works perfectly offline.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-semibold">Automatic Synchronization</h4>
                <p className="text-sm text-muted-foreground">
                  When online, changes are automatically synced with your Supabase database.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 text-purple-500 mt-0.5" />
              <div>
                <h4 className="font-semibold">Conflict Resolution</h4>
                <p className="text-sm text-muted-foreground">
                  Intelligent conflict resolution ensures data consistency across all devices.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
