import React, { useState } from 'react';
import { 
  RefreshCw, 
  Download, 
  Upload,
  Wifi,
  WifiOff,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useProfessionalSync } from '@/hooks/useProfessionalSync';
import ProfessionalSyncPanel from './ProfessionalSyncPanel';
import { cn } from '@/lib/utils';

export const SyncActionBar: React.FC = () => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { loading, syncNeeded, connectivity, performFullSync, uploadLocalChanges, totalUnsyncedCount } = useProfessionalSync();
  const { isOnline } = useConnectivity();

  const getSyncStatusColor = () => {
    if (loading) return 'bg-blue-500';
    if (!connectivity.connected) return 'bg-red-500';
    if (syncNeeded) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getSyncStatusText = () => {
    if (loading) return 'Syncing...';
    if (!connectivity.connected) return 'Offline';
    if (syncNeeded) return `${totalUnsyncedCount} unsynced`;
    return 'Synced';
  };

  const handleQuickSync = async () => {
    if (loading || !connectivity.connected) return;
    await performFullSync();
  };

  const handleUploadOnly = async () => {
    if (loading || !connectivity.connected || !syncNeeded) return;
    await uploadLocalChanges();
  };

  return (
    <>
      {/* Floating Action Bar */}
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="shadow-lg border-0 bg-white/95 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center space-x-3">
              {/* Status Indicator */}
              <div className="flex items-center space-x-2">
                <div className={cn("w-2 h-2 rounded-full", getSyncStatusColor())} />
                <span className="text-sm font-medium text-gray-700">
                  {getSyncStatusText()}
                </span>
                {connectivity.connected ? (
                  <Wifi className="w-4 h-4 text-green-600" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-600" />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {syncNeeded && connectivity.connected && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUploadOnly}
                    disabled={loading}
                    className="h-8 px-3"
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    Upload ({totalUnsyncedCount})
                  </Button>
                )}

                <Button
                  size="sm"
                  onClick={handleQuickSync}
                  disabled={loading || !connectivity.connected}
                  className="h-8 px-3"
                >
                  <RefreshCw className={cn("w-3 h-3 mr-1", loading && "animate-spin")} />
                  Sync
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsPanelOpen(true)}
                  className="h-8 px-2"
                >
                  <Download className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Sync Panel Modal */}
      {isPanelOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Professional Sync Manager</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPanelOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4">
              <ProfessionalSyncPanel />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SyncActionBar;
