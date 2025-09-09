import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Activity, User, BookOpen, Users, RefreshCw, Download, Filter, Calendar, Clock, ChevronLeft, ChevronRight, BookX, Trash2, AlertCircle, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useSystemLogsQuery, SystemLogWithUser } from '@/hooks/useSystemLogsQuery';
import { useStudents } from '@/hooks/useStudents';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const ProfessionalSystemLogs = () => {
  const { data: logs, isLoading, refetch } = useSystemLogsQuery();
  const { data: studentsResponse } = useStudents();
  const { toast } = useToast();
  
  // Extract students array safely
  const students = Array.isArray(studentsResponse?.students) ? studentsResponse.students : [];
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [componentFilter, setComponentFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [processedLogs, setProcessedLogs] = useState<SystemLogWithUser[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Process logs to replace student_id with student names and remove duplicates
  useEffect(() => {
    if (!logs || !students) return;
    
    const studentMap = new Map();
    students?.forEach(student => {
      studentMap.set(student.id, `${student.first_name} ${student.last_name} (${student.admission_number})`);
    });
    
    // Remove duplicates based on user_id, action_type, resource_type, and created_at (within 1 second)
    const deduplicatedLogs = logs.reduce((acc, log) => {
      const logTime = new Date(log.created_at).getTime();
      const existingLogIndex = acc.findIndex(existingLog => {
        const existingTime = new Date(existingLog.created_at).getTime();
        return existingLog.user_id === log.user_id &&
               existingLog.action_type === log.action_type &&
               existingLog.resource_type === log.resource_type &&
               existingLog.resource_id === log.resource_id &&
               Math.abs(existingTime - logTime) < 1000; // Within 1 second
      });
      
      if (existingLogIndex === -1) {
        acc.push(log);
      } else {
        // Keep the more recent log
        if (logTime > new Date(acc[existingLogIndex].created_at).getTime()) {
          acc[existingLogIndex] = log;
        }
      }
      
      return acc;
    }, [] as SystemLogWithUser[]);
    
    const processed = deduplicatedLogs.map(log => {
      // Create a copy of the log to modify
      const processedLog = { ...log };
      
      // If there are details and they contain student_id
      if (processedLog.details && typeof processedLog.details === 'object') {
        const details = { ...processedLog.details } as any;
        
        // Replace student_id with student name if it exists
        if (details.student_id && studentMap.has(details.student_id)) {
          details.student_name = studentMap.get(details.student_id);
        }
        
        // For lost books, replace Student Id with student name
        if (log.action_type === 'book_lost' && details.student_id) {
          details.student = studentMap.get(details.student_id) || 'Unknown Student';
          delete details.student_id;
        }
        
        // Process arrays that might contain student_id
        if (details.students && Array.isArray(details.students)) {
          details.students = details.students.map((studentId: string) => {
            if (studentMap.has(studentId)) {
              return { id: studentId, name: studentMap.get(studentId) };
            }
            return { id: studentId };
          });
        }
        
        processedLog.details = details;
      }
      
      return processedLog;
    });
    
    setProcessedLogs(processed);
  }, [logs, students]);

  // Clean duplicate logs function
  const cleanDuplicateLogs = async () => {
    try {
      if (!logs) return;
      
      const duplicateGroups = new Map();
      
      // Group logs by potential duplicates
      logs.forEach(log => {
        const key = `${log.user_id}-${log.action_type}-${log.resource_type}-${log.resource_id}-${format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}`;
        if (!duplicateGroups.has(key)) {
          duplicateGroups.set(key, []);
        }
        duplicateGroups.get(key).push(log);
      });
      
      // Find groups with duplicates
      const duplicatesToDelete = [];
      duplicateGroups.forEach(group => {
        if (group.length > 1) {
          // Keep the first one, delete the rest
          duplicatesToDelete.push(...group.slice(1).map(log => log.id));
        }
      });
      
      if (duplicatesToDelete.length > 0) {
        const { error } = await supabase
          .from('system_logs')
          .delete()
          .in('id', duplicatesToDelete);
        
        if (error) {
          throw error;
        }
        
        toast({
          title: 'Duplicates Cleaned',
          description: `Removed ${duplicatesToDelete.length} duplicate log entries`,
        });
        
        refetch();
      } else {
        toast({
          title: 'No Duplicates Found',
          description: 'All log entries are unique',
        });
      }
    } catch (error) {
      console.error('Failed to clean duplicates:', error);
      toast({
        title: 'Error',
        description: 'Failed to clean duplicate logs',
        variant: 'destructive',
      });
    }
  };

  // Get unique users for filter
  const uniqueUsers = Array.from(
    new Set(
      processedLogs?.map(log => 
        log.profiles?.first_name && log.profiles?.last_name 
          ? `${log.profiles.first_name} ${log.profiles.last_name}` 
          : 'System User'
      ) || []
    )
  );

  const getTimeRangeDate = () => {
    const now = new Date();
    switch (timeRange) {
      case '24h':
        return subDays(now, 1);
      case '7d':
        return subDays(now, 7);
      case '30d':
        return subDays(now, 30);
      default:
        return subDays(now, 1);
    }
  };

  const filteredLogs = processedLogs?.filter(log => {
    const matchesSearch = searchTerm === '' || 
      log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.profiles?.email && log.profiles.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesSeverity = severityFilter === 'all' || 
      (severityFilter === 'error' && log.action_type.includes('error')) ||
      (severityFilter === 'warning' && log.action_type.includes('warning')) ||
      (severityFilter === 'success' && (log.action_type.includes('created') || log.action_type.includes('updated'))) ||
      (severityFilter === 'info' && !log.action_type.includes('error') && !log.action_type.includes('warning'));
    
    const matchesComponent = componentFilter === 'all' || log.resource_type === componentFilter;
    
    const logDate = new Date(log.created_at);
    const timeRangeStart = getTimeRangeDate();
    const matchesTimeRange = isWithinInterval(logDate, {
      start: startOfDay(timeRangeStart),
      end: endOfDay(new Date())
    });

    return matchesSearch && matchesSeverity && matchesComponent && matchesTimeRange;
  }) || [];
  
  // Pagination calculations
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentItems = filteredLogs.slice(startIndex, endIndex);

  const getSeverityIcon = (actionType: string) => {
    if (actionType.includes('error')) return <XCircle className="w-4 h-4 text-red-500" />;
    if (actionType.includes('warning')) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    if (actionType.includes('created') || actionType.includes('updated')) return <CheckCircle className="w-4 h-4 text-green-500" />;
    return <Info className="w-4 h-4 text-blue-500" />;
  };

  const getSeverityColor = (actionType: string) => {
    if (actionType.includes('error')) return 'bg-red-100 text-red-800 border-red-200';
    if (actionType.includes('warning')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (actionType.includes('created') || actionType.includes('updated')) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getUserTypeColor = (role: string | undefined) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'librarian':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const formatActionType = (actionType: string) => {
    return actionType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format log details for display, highlighting student names
  const formatLogDetails = (details: any) => {
    if (!details) return null;
    
    // Create a formatted version for display
    const formattedDetails = { ...details };
    
    // Remove technical fields that don't need to be displayed
    delete formattedDetails.log_identifier;
    delete formattedDetails.log_hash;
    delete formattedDetails.client_timestamp;
    delete formattedDetails.timestamp;
    
    // If we have a student_name, display it prominently
    if (formattedDetails.student_name) {
      formattedDetails.student = formattedDetails.student_name;
      delete formattedDetails.student_id;
      delete formattedDetails.student_name;
    }
    
    // Format arrays of students
    if (formattedDetails.students && Array.isArray(formattedDetails.students)) {
      formattedDetails.students = formattedDetails.students.map((student: any) => {
        return student.name || student.id;
      });
    }
    
    return formattedDetails;
  };

  const exportLogs = () => {
    const csvContent = filteredLogs.map(log => ({
      Timestamp: format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      User: log.profiles ? `${log.profiles.first_name} ${log.profiles.last_name}` : 'System',
      Action: log.action_type,
      Resource: log.resource_type,
      Details: log.details ? JSON.stringify(log.details) : ''
    }));

    const csv = [
      Object.keys(csvContent[0]).join(','),
      ...csvContent.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSeverityFilter('all');
    setComponentFilter('all');
    setTimeRange('24h');
  };
  
  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  // Handle items per page change
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value, 10));
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-muted-foreground">Loading system logs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportLogs}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={cleanDuplicateLogs}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clean Duplicates
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]">
              <Clock className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[120px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
              <SelectItem value="warning">Warnings</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
            </SelectContent>
          </Select>

          <Select value={componentFilter} onValueChange={setComponentFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Component" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Components</SelectItem>
              {Array.from(new Set(processedLogs.map(log => log.resource_type))).sort().map(component => (
                <SelectItem key={component} value={component}>
                  {component}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(searchTerm || severityFilter !== 'all' || componentFilter !== 'all' || timeRange !== '24h') && (
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            {currentItems.length > 0 ? (
              <div className="divide-y divide-border">
                {currentItems.map((log) => (
                  <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex-shrink-0 mt-1">
                      <div className={`p-2 rounded-full ${getSeverityColor(log.action_type)}`}>
                        {getSeverityIcon(log.action_type)}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={`${getSeverityColor(log.action_type)} border`}>
                              {formatActionType(log.action_type)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {log.resource_type}
                            </Badge>
                            {log.profiles?.role && (
                              <Badge className={`${getUserTypeColor(log.profiles.role)} text-xs`}>
                                {log.profiles.role}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-sm font-medium mb-1">
                            <span className="font-semibold">
                              {log.profiles?.first_name && log.profiles?.last_name 
                                ? `${log.profiles.first_name} ${log.profiles.last_name}`
                                : 'System User'
                              }
                            </span>
                          </div>
                          
                          {log.details && Object.keys(formatLogDetails(log.details) || {}).length > 0 && (
                            <div className="text-sm text-muted-foreground bg-muted p-3 rounded border mt-2">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                {Object.entries(formatLogDetails(log.details) as Record<string, any>).map(([key, value]) => (
                                  <div key={key} className="flex flex-col">
                                    <span className="font-medium text-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                                    <span className="text-muted-foreground">{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right text-sm text-muted-foreground flex-shrink-0">
                          <div className="font-medium">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(log.created_at), 'PPpp')}
                          </div>
                          {log.profiles && (
                            <div className="text-xs">
                              {log.profiles.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No logs found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || severityFilter !== 'all' || componentFilter !== 'all' || timeRange !== '24h'
                    ? 'No logs match your current filters. Try adjusting your search criteria.'
                    : 'No system logs have been recorded yet.'
                  }
                </p>
              </div>
            )}
          </div>
          
          {/* Pagination Controls */}
          {filteredLogs.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{endIndex} of {totalItems} logs
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center mr-4">
                  <span className="text-sm text-muted-foreground mr-2">Items per page:</span>
                  <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                    <SelectTrigger className="w-16 h-8">
                      <SelectValue placeholder="10" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <ChevronLeft className="h-4 w-4 -ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center gap-1 mx-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // Show pages around current page
                      let pageNum;
                      if (totalPages <= 5) {
                        // If 5 or fewer pages, show all
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        // If near start, show first 5 pages
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        // If near end, show last 5 pages
                        pageNum = totalPages - 4 + i;
                      } else {
                        // Otherwise show 2 before and 2 after current page
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(totalPages)}
                  >
                    <ChevronRight className="h-4 w-4" />
                    <ChevronRight className="h-4 w-4 -ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
