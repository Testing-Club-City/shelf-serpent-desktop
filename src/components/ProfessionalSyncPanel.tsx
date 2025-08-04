import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  RefreshCw, 
  Download, 
  Database, 
  Users, 
  BookOpen, 
  FolderOpen,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  WifiOff,
  FileText,
  UserCheck,
  GraduationCap,
  CloudDownload,
  Copy,
  DollarSign,
  Settings,
  UsersIcon,
  Shield
} from 'lucide-react';
import { useProfessionalSync } from '@/hooks/useProfessionalSync';
import { useConnectivity } from '@/hooks/useConnectivity';
import { cn } from '@/lib/utils';

interface SyncPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfessionalSyncPanel: React.FC<SyncPanelProps> = ({ isOpen, onClose }) => {
  const { 
    syncProgress, 
    syncBooks, 
    syncCategories, 
    syncStudents, 
    syncBorrowings,
    syncStaff,
    syncClasses,
    syncBookCopies,
    syncFines,
    syncFineSettings,
    syncGroupBorrowings,
    syncTheftReports,
    syncAll,
    pullAllDatabase,
    clearDatabase,
    getLocalStats,
    issyncing 
  } = useProfessionalSync();
  
  const { isOnline } = useConnectivity();
  const [localStats, setLocalStats] = useState({
    books: 0,
    students: 0,
    categories: 0,
    borrowings: 0,
    staff: 0,
    classes: 0,
    bookCopies: 0,
    fines: 0,
    fineSettings: 0,
    groupBorrowings: 0,
    theftReports: 0
  });

  useEffect(() => {
    if (isOpen) {
      // Get local statistics when panel opens
      getLocalStats().then(stats => {
        setLocalStats({
          books: stats.books || 0,
          students: stats.students || 0,
          categories: stats.categories || 0,
          borrowings: stats.borrowings || 0,
          staff: stats.staff || 0,
          classes: stats.classes || 0,
          bookCopies: stats.bookCopies || 0,
          fines: stats.fines || 0,
          fineSettings: stats.fineSettings || 0,
          groupBorrowings: stats.groupBorrowings || 0,
          theftReports: stats.theftReports || 0
        });
      }).catch(error => {
        console.error('Failed to get local stats:', error);
      });
    }
  }, [isOpen, getLocalStats]);

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return 'Never';
    const date = new Date(lastSync);
    return date.toLocaleString();
  };

  const getSyncStatusIcon = () => {
    if (issyncing) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (!isOnline) return <WifiOff className="h-4 w-4 text-red-500" />;
    if (syncProgress.errors.length > 0) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getSyncStatusText = () => {
    if (issyncing) return syncProgress.currentTask;
    if (!isOnline) return 'Offline - Cannot sync';
    if (syncProgress.errors.length > 0) return 'Sync completed with errors';
    return 'Ready to sync';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <Card className="w-full max-w-4xl m-4 mb-0 rounded-t-lg rounded-b-none shadow-2xl border-t">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <CardTitle>Professional Data Synchronization</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
          <CardDescription>
            Manage synchronization between local database and Supabase
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Sync Status */}
          <div className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg">
            {getSyncStatusIcon()}
            <div className="flex-1">
              <p className="font-medium">{getSyncStatusText()}</p>
              {syncProgress.lastSync && (
                <p className="text-sm text-muted-foreground flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Last sync: {formatLastSync(syncProgress.lastSync)}
                </p>
              )}
            </div>
            <Badge variant={isOnline ? "default" : "destructive"}>
              {isOnline ? "Online" : "Offline"}
            </Badge>
          </div>

          {/* Sync Progress */}
          {issyncing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{syncProgress.currentTask}</span>
                <span>{syncProgress.progress}/{syncProgress.total}</span>
              </div>
              <Progress 
                value={(syncProgress.progress / syncProgress.total) * 100} 
                className="h-2"
              />
            </div>
          )}

          {/* Local Data Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-center">
              <BookOpen className="h-5 w-5 mx-auto mb-1 text-blue-600" />
              <p className="text-xl font-bold text-blue-600">{localStats.books.toLocaleString()}</p>
              <p className="text-xs text-blue-600/70">Books</p>
            </div>
            <div className="p-3 bg-cyan-50 dark:bg-cyan-950/20 rounded-lg text-center">
              <Copy className="h-5 w-5 mx-auto mb-1 text-cyan-600" />
              <p className="text-xl font-bold text-cyan-600">{localStats.bookCopies.toLocaleString()}</p>
              <p className="text-xs text-cyan-600/70">Book Copies</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-green-600" />
              <p className="text-xl font-bold text-green-600">{localStats.students.toLocaleString()}</p>
              <p className="text-xs text-green-600/70">Students</p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg text-center">
              <FolderOpen className="h-5 w-5 mx-auto mb-1 text-purple-600" />
              <p className="text-xl font-bold text-purple-600">{localStats.categories}</p>
              <p className="text-xs text-purple-600/70">Categories</p>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg text-center">
              <FileText className="h-5 w-5 mx-auto mb-1 text-orange-600" />
              <p className="text-xl font-bold text-orange-600">{localStats.borrowings.toLocaleString()}</p>
              <p className="text-xs text-orange-600/70">Borrowings</p>
            </div>
            <div className="p-3 bg-teal-50 dark:bg-teal-950/20 rounded-lg text-center">
              <UserCheck className="h-5 w-5 mx-auto mb-1 text-teal-600" />
              <p className="text-xl font-bold text-teal-600">{localStats.staff?.toLocaleString() || 0}</p>
              <p className="text-xs text-teal-600/70">Staff</p>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg text-center">
              <GraduationCap className="h-5 w-5 mx-auto mb-1 text-indigo-600" />
              <p className="text-xl font-bold text-indigo-600">{localStats.classes?.toLocaleString() || 0}</p>
              <p className="text-xs text-indigo-600/70">Classes</p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg text-center">
              <DollarSign className="h-5 w-5 mx-auto mb-1 text-red-600" />
              <p className="text-xl font-bold text-red-600">{localStats.fines?.toLocaleString() || 0}</p>
              <p className="text-xs text-red-600/70">Fines</p>
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg text-center">
              <Settings className="h-5 w-5 mx-auto mb-1 text-yellow-600" />
              <p className="text-xl font-bold text-yellow-600">{localStats.fineSettings?.toLocaleString() || 0}</p>
              <p className="text-xs text-yellow-600/70">Fine Settings</p>
            </div>
            <div className="p-3 bg-pink-50 dark:bg-pink-950/20 rounded-lg text-center">
              <UsersIcon className="h-5 w-5 mx-auto mb-1 text-pink-600" />
              <p className="text-xl font-bold text-pink-600">{localStats.groupBorrowings?.toLocaleString() || 0}</p>
              <p className="text-xs text-pink-600/70">Group Borrowings</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-950/20 rounded-lg text-center">
              <Shield className="h-5 w-5 mx-auto mb-1 text-gray-600" />
              <p className="text-xl font-bold text-gray-600">{localStats.theftReports?.toLocaleString() || 0}</p>
              <p className="text-xs text-gray-600/70">Theft Reports</p>
            </div>
          </div>

          <Separator />

          {/* Sync Actions */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center">
              <Download className="h-4 w-4 mr-2" />
              Synchronization Actions
            </h4>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* Individual Sync Buttons */}
              <Button
                variant="outline"
                onClick={() => syncBooks(500)}
                disabled={!isOnline || issyncing}
                className="h-auto p-4 flex flex-col items-center space-y-2"
              >
                <BookOpen className="h-5 w-5" />
                <span className="text-sm">Sync Books</span>
                <span className="text-xs text-muted-foreground">Limit: 500</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => syncBookCopies(100000)}
                disabled={!isOnline || issyncing}
                className="h-auto p-4 flex flex-col items-center space-y-2"
              >
                <Copy className="h-5 w-5" />
                <span className="text-sm">Sync Book Copies</span>
                <span className="text-xs text-muted-foreground">Batched: 90K+ records</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => syncStudents(500)}
                disabled={!isOnline || issyncing}
                className="h-auto p-4 flex flex-col items-center space-y-2"
              >
                <Users className="h-5 w-5" />
                <span className="text-sm">Sync Students</span>
                <span className="text-xs text-muted-foreground">Limit: 500</span>
              </Button>

              <Button
                variant="outline"
                onClick={syncCategories}
                disabled={!isOnline || issyncing}
                className="h-auto p-4 flex flex-col items-center space-y-2"
              >
                <FolderOpen className="h-5 w-5" />
                <span className="text-sm">Sync Categories</span>
                <span className="text-xs text-muted-foreground">All data</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => syncBorrowings(1000)}
                disabled={!isOnline || issyncing}
                className="h-auto p-4 flex flex-col items-center space-y-2"
              >
                <FileText className="h-5 w-5" />
                <span className="text-sm">Sync Borrowings</span>
                <span className="text-xs text-muted-foreground">Limit: 1000</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => syncStaff(100)}
                disabled={!isOnline || issyncing}
                className="h-auto p-4 flex flex-col items-center space-y-2"
              >
                <UserCheck className="h-5 w-5" />
                <span className="text-sm">Sync Staff</span>
                <span className="text-xs text-muted-foreground">Limit: 100</span>
              </Button>

              <Button
                variant="outline"
                onClick={syncClasses}
                disabled={!isOnline || issyncing}
                className="h-auto p-4 flex flex-col items-center space-y-2"
              >
                <GraduationCap className="h-5 w-5" />
                <span className="text-sm">Sync Classes</span>
                <span className="text-xs text-muted-foreground">All data</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => syncFines(10000)}
                disabled={!isOnline || issyncing}
                className="h-auto p-4 flex flex-col items-center space-y-2"
              >
                <DollarSign className="h-5 w-5" />
                <span className="text-sm">Sync Fines</span>
                <span className="text-xs text-muted-foreground">Limit: 10K</span>
              </Button>

              <Button
                variant="outline"
                onClick={syncFineSettings}
                disabled={!isOnline || issyncing}
                className="h-auto p-4 flex flex-col items-center space-y-2"
              >
                <Settings className="h-5 w-5" />
                <span className="text-sm">Fine Settings</span>
                <span className="text-xs text-muted-foreground">All data</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => syncGroupBorrowings(10000)}
                disabled={!isOnline || issyncing}
                className="h-auto p-4 flex flex-col items-center space-y-2"
              >
                <UsersIcon className="h-5 w-5" />
                <span className="text-sm">Group Borrowings</span>
                <span className="text-xs text-muted-foreground">Limit: 10K</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => syncTheftReports(10000)}
                disabled={!isOnline || issyncing}
                className="h-auto p-4 flex flex-col items-center space-y-2"
              >
                <Shield className="h-5 w-5" />
                <span className="text-sm">Theft Reports</span>
                <span className="text-xs text-muted-foreground">Limit: 10K</span>
              </Button>
            </div>

            {/* Main Action Buttons */}
            <div className="space-y-3">
              {/* Pull All Database - Primary Action */}
              <Button
                onClick={pullAllDatabase}
                disabled={!isOnline || issyncing}
                className="w-full"
                size="lg"
                variant="default"
              >
                <CloudDownload className={cn("h-4 w-4 mr-2", issyncing && "animate-spin")} />
                {issyncing ? "Pulling Database..." : "🚀 Pull Complete Database"}
              </Button>

              {/* Secondary Actions */}
              <div className="flex space-x-3">
                <Button
                  onClick={syncAll}
                  disabled={!isOnline || issyncing}
                  className="flex-1"
                  size="lg"
                  variant="secondary"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", issyncing && "animate-spin")} />
                  {issyncing ? "Syncing..." : "Quick Sync"}
                </Button>

                <Button
                  variant="destructive"
                  onClick={clearDatabase}
                  disabled={issyncing}
                  size="lg"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Local DB
                </Button>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {syncProgress.errors.length > 0 && (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <h5 className="font-medium text-red-800 dark:text-red-200 mb-2 flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                Sync Errors
              </h5>
              <div className="space-y-1">
                {syncProgress.errors.map((error, index) => (
                  <p key={index} className="text-sm text-red-700 dark:text-red-300">
                    {error}
                  </p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
