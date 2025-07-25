
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSystemSettings, getSchoolNameFromSettings } from '@/hooks/useSystemSettings';
import {
  BarChart3,
  BookOpen,
  Users,
  UserCheck,
  FileText,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  BookMarked,
  GraduationCap,
  Shield
} from 'lucide-react';

const navigation = [
  { name: 'Overview', href: '/', icon: BarChart3 },
  { name: 'Books', href: '/books', icon: BookOpen },
  { name: 'Students', href: '/students', icon: Users },
  { name: 'Staff', href: '/staff', icon: GraduationCap },
  { name: 'Borrowing', href: '/borrowing', icon: UserCheck },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Profile', href: '/profile', icon: User },
];

const adminNavigation = [
  { name: 'Admin Panel', href: '/admin', icon: Shield, badge: 'Admin' },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { data: systemSettings, isLoading } = useSystemSettings();

  // Get school name from system settings with real-time updates
  const schoolName = getSchoolNameFromSettings(systemSettings || []);
  
  console.log('Sidebar - System settings:', systemSettings);
  console.log('Sidebar - School name:', schoolName);

  return (
    <div className={cn(
      "flex flex-col h-full bg-background border-r border-border transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <BookMarked className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg">{isLoading ? 'Loading...' : schoolName}</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-8 h-8 p-0"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 p-4">
        <nav className="space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  isCollapsed && "justify-center"
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}

          {/* Admin Section */}
          <div className="pt-4 border-t border-border">
            {!isCollapsed && (
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Administration
              </p>
            )}
            {adminNavigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    isCollapsed && "justify-center"
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span>{item.name}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </ScrollArea>
    </div>
  );
};
