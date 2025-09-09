
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, User, Calendar, Activity } from 'lucide-react';
import { useSystemLogsQuery } from '@/hooks/useSystemLogsQuery';
import { format } from 'date-fns';

interface UserActivityDetailsProps {
  userId: string;
  userName: string;
  userRole: string;
  onBack: () => void;
}

export const UserActivityDetails = ({ userId, userName, userRole, onBack }: UserActivityDetailsProps) => {
  const { data: logs, isLoading } = useSystemLogsQuery();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  // Filter logs for the specific user
  const userLogs = logs?.filter(log => log.user_id === userId) || [];

  // Apply search and filter
  const filteredLogs = userLogs.filter(log => {
    const matchesSearch = searchTerm === '' || 
      log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details && JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesAction = filterAction === 'all' || log.action_type === filterAction;
    
    return matchesSearch && matchesAction;
  });

  const getActionColor = (actionType: string) => {
    if (actionType.includes('created') || actionType.includes('added')) return 'bg-green-100 text-green-800';
    if (actionType.includes('updated') || actionType.includes('modified')) return 'bg-blue-100 text-blue-800';
    if (actionType.includes('deleted') || actionType.includes('removed')) return 'bg-red-100 text-red-800';
    if (actionType.includes('issued') || actionType.includes('borrowed')) return 'bg-yellow-100 text-yellow-800';
    if (actionType.includes('returned')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getActionIcon = (actionType: string) => {
    if (actionType.includes('book')) return '📚';
    if (actionType.includes('student')) return '👨‍🎓';
    if (actionType.includes('user')) return '👤';
    return '📋';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Users
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{userName}</h1>
            <Badge variant={userRole === 'admin' ? 'default' : 'secondary'}>
              {userRole}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{userLogs.length}</div>
            <p className="text-sm text-gray-500">All time activities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {userLogs.filter(log => {
                const logDate = new Date(log.created_at);
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                return logDate >= sevenDaysAgo;
              }).length}
            </div>
            <p className="text-sm text-gray-500">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Most Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-purple-600">
              {userLogs.length > 0 ? (() => {
                const actionCounts = userLogs.reduce((acc, log) => {
                  const action = log.action_type.split('_')[0];
                  acc[action] = (acc[action] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);
                const mostActive = Object.entries(actionCounts).sort(([,a], [,b]) => Number(b) - Number(a))[0];
                return mostActive ? `${mostActive[0]} (${mostActive[1]})` : 'No activity';
              })() : 'No activity'}
            </div>
            <p className="text-sm text-gray-500">Primary action type</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              <CardTitle>Activity History</CardTitle>
            </div>
            <div className="flex gap-4 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="book_created">Book Created</SelectItem>
                  <SelectItem value="book_updated">Book Updated</SelectItem>
                  <SelectItem value="book_issued">Book Issued</SelectItem>
                  <SelectItem value="book_returned">Book Returned</SelectItem>
                  <SelectItem value="student_created">Student Created</SelectItem>
                  <SelectItem value="student_updated">Student Updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-shrink-0 text-2xl">
                    {getActionIcon(log.action_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getActionColor(log.action_type)}>
                        {log.action_type.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {log.resource_type}
                      </span>
                    </div>
                    <div className="text-sm text-gray-900 mb-2">
                      <strong>{log.action_type.replace('_', ' ')}</strong> in {log.resource_type}
                    </div>
                    {log.details && (
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <strong>Details:</strong>
                        <pre className="mt-1 text-xs overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(log.created_at), 'PPpp')}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                {searchTerm || filterAction !== 'all' 
                  ? 'No activities found matching your criteria'
                  : 'No activities recorded for this user'
                }
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
