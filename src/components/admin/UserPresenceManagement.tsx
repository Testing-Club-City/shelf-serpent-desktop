import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Users, 
  Search, 
  Circle, 
  Clock, 
  UserX, 
  MessageCircle, 
  Shield,
  User,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useUserPresence } from '@/hooks/useUserPresence';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export const UserPresenceManagement = () => {
  const { data: users, isLoading, refetch } = useUserPresence();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  // Debug logging
  useEffect(() => {
    console.log('[UserPresenceManagement] users data:', users);
    if (Array.isArray(users)) {
      users.forEach(u =>
        console.log(
          `[UserPresenceManagement] User: ${u.email} (${u.id}) is_online=${u.is_online}, last_seen=${u.last_seen}`
        )
      );
    }
    console.log('[UserPresenceManagement] isLoading:', isLoading);
  }, [users, isLoading]);

  // Refresh presence data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Auto-refreshing presence data...');
      refetch();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetch]);

  // Filter users based on search term
  const filteredUsers = users?.filter(user => 
    `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Separate online and offline users
  const onlineUsers = filteredUsers.filter(user => user.is_online === true);
  const offlineUsers = filteredUsers.filter(user => user.is_online !== true);

  console.log('Filtered users:', filteredUsers.length);
  console.log('Online users:', onlineUsers.length);
  console.log('Offline users:', offlineUsers.length);

  const getUserInitials = (firstName: string | null, lastName: string | null) => {
    return `${firstName?.charAt(0) || 'U'}${lastName?.charAt(0) || 'N'}`.toUpperCase();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'librarian':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-3 h-3" />;
      case 'librarian':
        return <User className="w-3 h-3" />;
      default:
        return <User className="w-3 h-3" />;
    }
  };

  const handleSendMessage = (userId: string, userName: string) => {
    toast({
      title: 'Message Feature',
      description: `Message functionality for ${userName} will be implemented soon.`,
    });
  };

  const handleViewActivity = (userId: string, userName: string) => {
    toast({
      title: 'Activity Logs',
      description: `Viewing activity logs for ${userName}...`,
    });
  };

  const handleRefresh = () => {
    console.log('Manual refresh triggered');
    refetch();
    toast({
      title: 'Refreshed',
      description: 'User presence data has been refreshed.',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-gray-500">Loading user presence data...</span>
        </div>
      </div>
    );
  }

  // Show debug information if no users found
  if (!users || users.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Presence Management</h1>
            <p className="text-gray-600">Monitor online users and manage user activities</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No User Data Found</h3>
            <p className="text-gray-600 mb-4">
              No users are currently in the system or there might be a database connection issue.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg text-sm text-left">
              <p className="font-medium mb-2">Debug Information:</p>
              <ul className="space-y-1 text-gray-600">
                <li>• Total users in query: {users?.length || 0}</li>
                <li>• Loading state: {isLoading ? 'Yes' : 'No'}</li>
                <li>• Check console for detailed logs</li>
              </ul>
            </div>
            <Button onClick={handleRefresh} className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-green-600 border-green-200">
            <Circle className="w-2 h-2 mr-1 fill-green-600" />
            {onlineUsers.length} Online
          </Badge>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Online Users */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Circle className="w-4 h-4 text-green-600 fill-green-600" />
              Online Users ({onlineUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {onlineUsers.length > 0 ? (
              onlineUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-green-100 text-green-700">
                        {getUserInitials(user.first_name, user.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </p>
                        <Badge className={`${getRoleColor(user.role)} text-xs`}>
                          {getRoleIcon(user.role)}
                          <span className="ml-1">{user.role}</span>
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <p className="text-xs text-green-600">
                        Active since {user.last_seen ? formatDistanceToNow(new Date(user.last_seen), { addSuffix: true }) : 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendMessage(user.id, `${user.first_name} ${user.last_name}`)}
                    >
                      <MessageCircle className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewActivity(user.id, `${user.first_name} ${user.last_name}`)}
                    >
                      <Clock className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <UserX className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No users currently online</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently Active Users */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-600" />
              Recently Active ({offlineUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {offlineUsers.length > 0 ? (
              offlineUsers
                .sort((a, b) => new Date(b.last_seen || 0).getTime() - new Date(a.last_seen || 0).getTime())
                .slice(0, 10)
                .map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-gray-100 text-gray-700">
                          {getUserInitials(user.first_name, user.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </p>
                          <Badge className={`${getRoleColor(user.role)} text-xs`}>
                            {getRoleIcon(user.role)}
                            <span className="ml-1">{user.role}</span>
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        <p className="text-xs text-gray-500">
                          Last seen {user.last_seen ? formatDistanceToNow(new Date(user.last_seen), { addSuffix: true }) : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewActivity(user.id, `${user.first_name} ${user.last_name}`)}
                      >
                        <Clock className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No recent activity data</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{onlineUsers.length}</div>
            <div className="text-sm text-gray-600">Currently Online</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {filteredUsers.filter(u => u.role === 'admin').length}
            </div>
            <div className="text-sm text-gray-600">Admin Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {filteredUsers.filter(u => u.role === 'librarian').length}
            </div>
            <div className="text-sm text-gray-600">Librarians</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{filteredUsers.length}</div>
            <div className="text-sm text-gray-600">Total Users</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

