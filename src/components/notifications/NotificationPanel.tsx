import React from 'react';
import { Bell, Check, CheckCheck, Clock, Info, AlertTriangle, BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  user_id: string;
  related_id: string | null;
}

export const NotificationPanel = () => {
  const { data: notifications, isLoading } = useNotifications();
  const markAsRead = useMarkNotificationRead();
  const markAllAsRead = useMarkAllNotificationsRead();
  const navigate = useNavigate();
  
  const unreadNotifications = notifications?.filter(n => !n.read) || [];
  const hasUnread = unreadNotifications.length > 0;

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

  const handleNotificationClick = (notification: Notification) => {
    // Mark notification as read
    markAsRead.mutate(notification.id);
    
    // Navigate based on type
    if (notification.type === 'overdue' && notification.related_id) {
      // Navigate to borrowing page with query parameters to filter for this specific borrowing
      // Since the application doesn't have a dedicated borrowing detail page
      navigate(`/borrowing?search=${notification.related_id}&status=overdue`);
    } else if (notification.type === 'overdue') {
      // Fallback to all overdue borrowings if no specific ID
      navigate(`/borrowing?status=overdue`);
    } else {
      // For other notification types, just go to notifications page
      navigate('/notifications');
    }
  };

  const handleMarkAllAsRead = () => {
    if (hasUnread) {
      markAllAsRead.mutate();
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative"
        >
          <Bell className="w-5 h-5" />
          {hasUnread && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadNotifications.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-lg">Notifications</h3>
            <p className="text-sm text-gray-500">
              {hasUnread 
                ? `You have ${unreadNotifications.length} unread notification${unreadNotifications.length !== 1 ? 's' : ''}`
                : 'No new notifications'}
            </p>
          </div>
          {hasUnread && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
              className="h-8"
            >
              {markAllAsRead.isPending ? (
                <span className="flex items-center">
                  <span className="animate-spin mr-1">◌</span>
                  Marking...
                </span>
              ) : (
                <span className="flex items-center">
                  <CheckCheck className="w-4 h-4 mr-1" />
                  Mark all read
                </span>
              )}
            </Button>
          )}
        </div>
        
        <Tabs defaultValue="unread" className="w-full">
          <TabsList className="w-full grid grid-cols-2 p-0 h-10">
            <TabsTrigger value="unread" className="rounded-none">
              Unread {hasUnread && `(${unreadNotifications.length})`}
            </TabsTrigger>
            <TabsTrigger value="all" className="rounded-none">
              All {notifications?.length ? `(${notifications.length})` : '(0)'}
            </TabsTrigger>
          </TabsList>
          
          <div className="max-h-96 overflow-y-auto">
            <TabsContent value="unread" className="m-0">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : unreadNotifications.length > 0 ? (
                unreadNotifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start">
                      <div className="mr-3 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{notification.title}</p>
                        <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {format(new Date(notification.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead.mutate(notification.id);
                        }}
                      >
                        <X className="h-4 w-4 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">No unread notifications</div>
              )}
            </TabsContent>
            
            <TabsContent value="all" className="m-0">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : notifications && notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={cn(
                      "p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer",
                      notification.read ? "opacity-70" : ""
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start">
                      <div className="mr-3 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <p className={cn(
                          "font-medium text-sm",
                          notification.read ? "font-normal" : ""
                        )}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {format(new Date(notification.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      {!notification.read && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0"
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
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">No notifications</div>
              )}
            </TabsContent>
          </div>
        </Tabs>
        
        <div className="p-3 border-t border-gray-100">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => navigate('/notifications')}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            View All Notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
