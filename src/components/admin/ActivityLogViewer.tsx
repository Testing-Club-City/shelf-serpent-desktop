import React, { useState } from 'react';
import { format } from 'date-fns';
import { 
  Download, 
  Trash2, 
  RefreshCw, 
  Search, 
  Filter,
  FileText,
  Info,
  AlertTriangle,
  AlertCircle,
  Bug,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger, ActivityLogEntry, ActivityLogStats } from '@/hooks/useActivityLogger';

interface ActivityLogViewerProps {
  defaultLimit?: number;
  showExport?: boolean;
  showClear?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const ActivityLogViewer: React.FC<ActivityLogViewerProps> = ({
  defaultLimit = 100,
  showExport = true,
  showClear = true,
  autoRefresh = false,
  refreshInterval = 30000
}) => {
  const { toast } = useToast();
  const { getLogs, getStats, exportLogs, clearLogs } = useActivityLogger();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [limit, setLimit] = useState(defaultLimit);

  // Fetch logs and stats
  const { data: logs = [], isLoading: logsLoading, refetch: refetchLogs } = getLogs(limit);
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = getStats;

  // Auto-refresh setup
  React.useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refetchLogs();
      refetchStats();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refetchLogs, refetchStats]);

  // Filter logs based on search and filters
  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource_type?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;

    return matchesSearch && matchesLevel && matchesCategory;
  });

  // Get unique categories for filter
  const categories = ['all', ...new Set(logs.map(log => log.category))];

  const handleExport = async () => {
    try {
      // Open file save dialog (simplified - in real app you'd use Tauri's save dialog)
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
      const filename = `activity-logs-${timestamp}.json`;
      
      const result = await exportLogs.mutateAsync({ 
        exportPath: filename, 
        limit 
      });
      
      toast({
        title: "Export Successful",
        description: result,
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all activity logs? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await clearLogs.mutateAsync(true);
      toast({
        title: "Logs Cleared",
        description: result,
        variant: "default"
      });
      refetchLogs();
      refetchStats();
    } catch (error) {
      toast({
        title: "Clear Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'trace':
      case 'debug':
        return <Bug className="w-4 h-4" />;
      case 'info':
        return <Info className="w-4 h-4" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4" />;
      case 'error':
      case 'critical':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'trace':
        return 'bg-gray-500';
      case 'debug':
        return 'bg-blue-500';
      case 'info':
        return 'bg-green-500';
      case 'warn':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      case 'critical':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
            <p className="text-xs text-muted-foreground">
              Showing last {limit} entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Log File Size</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(stats?.file_size_bytes)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.backup_files?.length || 0} backup files
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filtered Results</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredLogs.length}</div>
            <p className="text-xs text-muted-foreground">
              After applying filters
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Activity Logs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="trace">Trace</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="500">500</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => { refetchLogs(); refetchStats(); }}
              disabled={logsLoading || statsLoading}
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            {showExport && (
              <Button
                onClick={handleExport}
                disabled={exportLogs.isPending}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}

            {showClear && (
              <Button
                onClick={handleClear}
                disabled={clearLogs.isPending}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Logs
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">
                      {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className={`${getLevelColor(log.level)} text-white flex items-center gap-1`}
                      >
                        {getLevelIcon(log.level)}
                        {log.level.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.category}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {log.action}
                    </TableCell>
                    <TableCell>
                      {log.resource_type && (
                        <div className="text-sm">
                          <div className="font-medium">{log.resource_type}</div>
                          {log.resource_id && (
                            <div className="text-muted-foreground text-xs truncate max-w-[100px]">
                              {log.resource_id}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.user_email && (
                        <div className="text-sm">
                          <div className="truncate max-w-[150px]">{log.user_email}</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.details && (
                        <details className="cursor-pointer">
                          <summary className="text-xs text-muted-foreground">
                            View Details
                          </summary>
                          <pre className="mt-2 text-xs bg-muted p-2 rounded max-w-[300px] overflow-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      )}
                      {log.error_message && (
                        <div className="text-xs text-red-600 mt-1">
                          Error: {log.error_message}
                        </div>
                      )}
                      {log.duration_ms && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Duration: {log.duration_ms}ms
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No activity logs found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
