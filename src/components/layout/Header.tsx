
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bell, User, Settings, LogOut, Moon, Sun } from 'lucide-react';
import { useOfflineAuth } from '@/hooks/useOfflineAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useSystemSettings, getSchoolNameFromSettings } from '@/hooks/useSystemSettings';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { useTheme } from 'next-themes';

export const Header = () => {
  const { user, logout } = useOfflineAuth();
  const { data: notifications } = useNotifications();
  const { data: systemSettings, isLoading: settingsLoading } = useSystemSettings();
  const { theme, setTheme } = useTheme();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications?.filter(n => !n.read).length || 0;
  const schoolName = getSchoolNameFromSettings(systemSettings || []);

  console.log('Header - System settings:', systemSettings);
  console.log('Header - School name:', schoolName);

  const getInitials = (email?: string) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <>
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-foreground">
              {settingsLoading ? 'Loading...' : schoolName}
            </h1>
            <Badge variant="secondary" className="text-xs">
              Library Management
            </Badge>
          </div>

          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="w-9 h-9 rounded-full"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNotifications(true)}
              className="relative w-9 h-9 rounded-full"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 w-5 h-5 text-xs flex items-center justify-center p-0"
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(user?.email)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-popover border border-border" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium text-sm text-foreground">{user?.email}</p>
                    <p className="w-[200px] truncate text-xs text-muted-foreground">
                      Library System User
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem 
                  onClick={() => setShowProfile(true)}
                  className="cursor-pointer text-foreground hover:bg-accent"
                >
                  <User className="mr-2 h-4 w-4" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setShowNotifications(true)}
                  className="cursor-pointer text-foreground hover:bg-accent"
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Notifications
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {unreadCount}
                    </Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem 
                  onClick={logout}
                  className="cursor-pointer text-foreground hover:bg-accent"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Profile Dialog */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="max-w-2xl bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Profile Settings</DialogTitle>
          </DialogHeader>
          <ProfileForm />
        </DialogContent>
      </Dialog>

      {/* Notifications Dialog */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="max-w-2xl bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Notifications</DialogTitle>
          </DialogHeader>
          <NotificationPanel />
        </DialogContent>
      </Dialog>
    </>
  );
};
