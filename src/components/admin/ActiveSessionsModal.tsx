
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { User, Clock, Wifi, WifiOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ActiveSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActiveSessionsModal: React.FC<ActiveSessionsModalProps> = ({ isOpen, onClose }) => {
  const { data: userSessions, isLoading } = useQuery({
    queryKey: ['user-sessions'],
    queryFn: async () => {
      console.log('Fetching user sessions...');
      
      // Get all profiles with their online status and last seen
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, is_online, last_seen, role')
        .order('is_online', { ascending: false })
        .order('last_seen', { ascending: false });

      if (error) {
        console.error('Error fetching profiles:', error);
        throw error;
      }

      // Get recent system logs to supplement activity data
      const { data: recentLogs } = await supabase
        .from('system_logs')
        .select('user_id, created_at, action_type')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false });

      // Enhance profiles with recent activity
      const enhancedProfiles = profiles?.map(profile => {
        const userLogs = recentLogs?.filter(log => log.user_id === profile.id) || [];
        const lastActivity = userLogs.length > 0 ? userLogs[0].created_at : profile.last_seen;
        
        return {
          ...profile,
          lastActivity,
          recentActions: userLogs.length,
          isRecentlyActive: lastActivity && 
            new Date(lastActivity) > new Date(Date.now() - 30 * 60 * 1000) // Active in last 30 minutes
        };
      }) || [];

      console.log('Enhanced profiles:', enhancedProfiles);
      return enhancedProfiles;
    },
    enabled: isOpen,
    refetchInterval: 30000, // Refresh every 30 seconds when modal is open
  });

  const formatLastSeen = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const lastSeen = new Date(timestamp);
    const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getInitials = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const onlineUsers = userSessions?.filter(user => user.is_online || user.isRecentlyActive) || [];
  const offlineUsers = userSessions?.filter(user => !user.is_online && !user.isRecentlyActive) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Active Sessions & User Status
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Online Users */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wifi className="w-4 h-4 text-green-600" />
              <h3 className="font-semibold text-green-600">
                Online Users ({onlineUsers.length})
              </h3>
            </div>
            
            {onlineUsers.length > 0 ? (
              <div className="space-y-2">
                {onlineUsers.map((user) => (
                  <Card key={user.id} className="border-green-200 bg-green-50/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-green-100 text-green-700">
                              {getInitials(user.first_name, user.last_name, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div>
                            <div className="font-medium">
                              {user.first_name && user.last_name 
                                ? `${user.first_name} ${user.last_name}`
                                : user.email
                              }
                            </div>
                            <div className="text-sm text-gray-600">{user.email}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-700">
                            {user.role}
                          </Badge>
                          <Badge className="bg-green-500 text-white">
                            <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
                            Online
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last seen: {formatLastSeen(user.lastActivity)}
                        </div>
                        {user.recentActions > 0 && (
                          <div>
                            {user.recentActions} actions in last 24h
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                No users currently online
              </div>
            )}
          </div>

          {/* Offline Users */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <WifiOff className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-gray-600">
                Offline Users ({offlineUsers.length})
              </h3>
            </div>
            
            {offlineUsers.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {offlineUsers.map((user) => (
                  <Card key={user.id} className="border-gray-200">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-gray-100 text-gray-600">
                              {getInitials(user.first_name, user.last_name, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div>
                            <div className="font-medium text-sm">
                              {user.first_name && user.last_name 
                                ? `${user.first_name} ${user.last_name}`
                                : user.email
                              }
                            </div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {user.role}
                          </Badge>
                          <div className="text-xs text-gray-500">
                            {formatLastSeen(user.lastActivity)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                All users are online
              </div>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading user sessions...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
