import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSystemSettings, getSchoolNameFromSettings } from '@/hooks/useSystemSettings';
import { 
  BookOpen, 
  Users, 
  BookMarked, 
  BarChart3, 
  Settings, 
  Activity,
  Calendar,
  GraduationCap,
  Currency,
  Shield,
  UserPlus,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const adminMenuItems = [
  { icon: BarChart3, label: 'Dashboard', path: '/' },
  { icon: BookOpen, label: 'Books', path: '/books' },
  { icon: Users, label: 'Students', path: '/students' },
  { icon: BookMarked, label: 'Borrowings', path: '/borrowings' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { 
    icon: Shield, 
    label: 'Admin Panel', 
    path: '/admin/settings',
    isAdmin: true,
    submenu: [
      { icon: Users, label: 'User Management', path: '/admin/settings?tab=users' },
      { icon: UserPlus, label: 'Bulk Entry', path: '/admin/settings?tab=bulk-entry' },
      { icon: BookOpen, label: 'Classes', path: '/admin/settings?tab=classes' },
      { icon: GraduationCap, label: 'Graduated', path: '/admin/settings?tab=graduated' },
      { icon: Currency, label: 'Fine Settings', path: '/admin/settings?tab=fines' },
      { icon: Calendar, label: 'Calendar', path: '/admin/settings?tab=calendar' },
      { icon: Settings, label: 'System Settings', path: '/admin/settings?tab=settings' },
      { icon: FileText, label: 'Activity Logs', path: '/admin/settings?tab=logs' },
    ]
  }
];

interface AdminSidebarProps {
  schoolName?: string;
}

export const AdminSidebar = ({ schoolName: propSchoolName }: AdminSidebarProps) => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>('/admin/settings');
  const { data: systemSettings, isLoading } = useSystemSettings();

  // Use prop first, then system settings, then fallback
  const schoolName = propSchoolName || getSchoolNameFromSettings(systemSettings || []);
  
  const toggleSubmenu = (path: string) => {
    setExpandedMenu(expandedMenu === path ? null : path);
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path) || location.search.includes(path.split('?')[1]);
  };

  return (
    <aside className={cn(
      "bg-white border-r border-gray-200 transition-all duration-300 flex flex-col shadow-sm",
      isCollapsed ? "w-16" : "w-72"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-900 text-base truncate">
                {isLoading ? 'Loading...' : schoolName}
              </h1>
              <p className="text-xs text-gray-600">Admin Portal</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {adminMenuItems.map((item) => {
            const itemIsActive = isActive(item.path);
            const hasSubmenu = item.submenu && item.submenu.length > 0;
            const isExpanded = expandedMenu === item.path;

            return (
              <li key={item.path}>
                {hasSubmenu ? (
                  <div>
                    <button
                      onClick={() => toggleSubmenu(item.path)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 w-full",
                        itemIsActive 
                          ? "bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 border border-blue-200 shadow-sm" 
                          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      <item.icon className={cn(
                        "w-5 h-5 transition-colors", 
                        itemIsActive ? "text-blue-700" : "text-gray-500"
                      )} />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronRight className={cn(
                            "w-4 h-4 transition-transform",
                            isExpanded && "rotate-90"
                          )} />
                        </>
                      )}
                    </button>
                    
                    {!isCollapsed && isExpanded && (
                      <ul className="mt-2 ml-4 space-y-1">
                        {item.submenu.map((subItem) => {
                          const subIsActive = isActive(subItem.path);
                          return (
                            <li key={subItem.path}>
                              <Link
                                to={subItem.path}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                                  subIsActive 
                                    ? "bg-blue-50 text-blue-700 font-medium" 
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                )}
                              >
                                <subItem.icon className={cn(
                                  "w-4 h-4", 
                                  subIsActive ? "text-blue-700" : "text-gray-400"
                                )} />
                                <span>{subItem.label}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : (
                  <Link
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                      itemIsActive 
                        ? "bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 border border-blue-200 shadow-sm" 
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <item.icon className={cn(
                      "w-5 h-5 transition-colors", 
                      itemIsActive ? "text-blue-700" : "text-gray-500"
                    )} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
