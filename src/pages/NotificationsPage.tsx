import { useState } from 'react';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Check, CheckCheck, Clock, Info, AlertTriangle, Loader2, Bell, X, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export const NotificationsPage = () => {
  const { data: notifications, isLoading } = useNotifications();
  const markAsRead = useMarkNotificationRead();
  const markAllAsRead = useMarkAllNotificationsRead();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<string>('all');
  const navigate = useNavigate();

  const filteredNotifications = notifications?.filter(notification => {
    const matchesType = typeFilter === 'all' || notification.type === typeFilter;
    const matchesReadStatus = 
      readFilter === 'all' || 
      (readFilter === 'read' && notification.read) || 
      (readFilter === 'unread' && !notification.read);
    
    return matchesType && matchesReadStatus;
  }) || [];

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'overdue':
        return <Clock className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'success':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getNotificationBadge = (type: string) => {
    switch (type) {
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Overdue</Badge>;
      case 'warning':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Warning</Badge>;
      case 'success':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Success</Badge>;
      case 'info':
      default:
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Info</Badge>;
    }
  };

  const handleMarkAllAsRead = () => {
    if (unreadCount > 0) {
      markAllAsRead.mutate();
    }
  };

  const handleNotificationClick = (id: string, type: string, relatedId?: string) => {
    // Mark as read
    markAsRead.mutate(id);
    
    // Navigate based on type
    if (type === 'overdue' && relatedId) {
      navigate(`/borrowing?status=overdue`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">
            {unreadCount > 0 
              ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up! No unread notifications'}
          </p>
        </div>
        
        <div className="flex space-x-2">
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
            >
              {markAllAsRead.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCheck className="w-4 h-4 mr-2" />
                  Mark all as read
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex space-x-4">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="success">Success</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={readFilter} onValueChange={setReadFilter}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="text-sm text-gray-500">
          Showing {filteredNotifications.length} of {notifications?.length || 0} notifications
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="w-5 h-5 mr-2" />
            Notification Center
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filteredNotifications.length > 0 ? (
            <div className="space-y-4">
              {filteredNotifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={cn(
                    "p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors",
                    notification.read ? "bg-gray-50" : "bg-white"
                  )}
                  onClick={() => handleNotificationClick(notification.id, notification.type, notification.related_id)}
                >
                  <div className="flex items-start">
                    <div className="mr-4 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={cn(
                          "text-md",
                          notification.read ? "font-normal" : "font-semibold"
                        )}>
                          {notification.title}
                        </h3>
                        <div className="flex items-center space-x-2">
                          {getNotificationBadge(notification.type)}
                          {!notification.read && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead.mutate(notification.id);
                              }}
                            >
                              <X className="h-4 w-4 text-gray-400" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(notification.created_at), 'MMMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <Bell className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No notifications match your filter criteria</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
