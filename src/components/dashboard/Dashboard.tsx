import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Search, 
  BarChart3, 
  BookOpen, 
  Users, 
  User, 
  FileText, 
  Crown, 
  Menu, 
  X, 
  Settings, 
  LogOut,
  RefreshCw 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

import ConnectionStatus from '@/components/ConnectionStatus';
import { DashboardOverview } from './DashboardOverview';
import { BookManagement } from '@/components/books/BookManagement';
import { StudentManagement } from '@/components/students/StudentManagement';
import { StaffManagement } from '@/components/staff/StaffManagement';
import { BorrowingManagement } from '@/components/borrowing/BorrowingManagement';
import { Reports } from '@/components/reports/Reports';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { StudentDetails } from '@/components/students/StudentDetails';
import { BookDetails } from '@/components/books/BookDetails';
import { BorrowingDetails } from '@/components/borrowings/BorrowingDetails';
import ProfessionalSyncPanel from '../ProfessionalSyncPanel';
import SyncStatusIndicator from '../sync/SyncStatusIndicator';
import { useProfile } from '@/hooks/useProfile';
import { useOfflineAuth } from '@/hooks/useOfflineAuth';
import { useSystemSettings, getSchoolNameFromSettings } from '@/hooks/useSystemSettings';
import WindowsContextMenu from '@/components/WindowsContextMenu';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';



export type TabType = 'overview' | 'books' | 'students' | 'staff' | 'borrowing' | 'reports' | 'dashboard' | 'profile' | 'admin' | 'sync';

export const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Detail view states
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [selectedBorrowing, setSelectedBorrowing] = useState<any>(null);
  
  // Quick action states for direct navigation
  const [openAddBookForm, setOpenAddBookForm] = useState(false);
  const [openAddStudentForm, setOpenAddStudentForm] = useState(false);
  const [borrowingInitialTab, setBorrowingInitialTab] = useState('overview');
  const [adminInitialTab, setAdminInitialTab] = useState('overview');
  
  const { data: profile } = useProfile();
  const { logout } = useOfflineAuth();
  const { data: systemSettings, isLoading: settingsLoading, refetch: refetchSettings } = useSystemSettings();

  // Get school name from system settings with proper loading handling
  const schoolName = getSchoolNameFromSettings(systemSettings || []);

  // Force refetch settings when component mounts to ensure fresh data
  useEffect(() => {
    refetchSettings();
  }, [refetchSettings]);

  // Keyboard shortcuts for fullscreen and zoom
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // F11 for fullscreen toggle
      if (event.key === 'F11') {
        event.preventDefault();
        invoke('toggle_fullscreen')
          .then(() => {})
          .catch(console.error);
      }
      
      // Ctrl + Plus to zoom in
      if (event.ctrlKey && event.key === '+') {
        event.preventDefault();
        invoke('zoom_in')
          .then(() => {})
          .catch(console.error);
      }
      
      // Ctrl + Minus to zoom out
      if (event.ctrlKey && event.key === '-') {
        event.preventDefault();
        invoke('zoom_out')
          .then(() => {})
          .catch(console.error);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Listen for fullscreen changes from the backend
  useEffect(() => {
    const setupFullscreenListener = async () => {
      try {
        const unlisten = await listen('fullscreen-changed', (event) => {
          const isNowFullscreen = event.payload as boolean;
          console.log('Fullscreen state changed:', isNowFullscreen);
          setIsFullscreen(isNowFullscreen);
          
          // Apply CSS classes to body for fullscreen adjustments
          if (isNowFullscreen) {
            document.body.classList.add('fullscreen-mode');
            document.documentElement.classList.add('fullscreen-mode');
          } else {
            document.body.classList.remove('fullscreen-mode');
            document.documentElement.classList.remove('fullscreen-mode');
          }
        });
        
        return unlisten;
      } catch (error) {
        console.error('Failed to setup fullscreen listener:', error);
      }
    };
    
    let unlisten: (() => void) | undefined;
    setupFullscreenListener().then((unlistenFn) => {
      unlisten = unlistenFn;
    });
    
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Get user role and info
  const userRole = (profile as any)?.role || 'librarian';
  const isAdmin = userRole === 'admin';
  const userName = `${(profile as any)?.first_name || ''} ${(profile as any)?.last_name || ''}`.trim() || (profile as any)?.email || 'User';
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  const handleLogout = async () => {
    await logout();
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSidebarOpen(false); // Close sidebar on mobile when tab is selected
    
    // Clear any open detail views when changing tabs
    setSelectedStudent(null);
    setSelectedBook(null);
    setSelectedBorrowing(null);

    
    // Reset quick action states only when switching away from respective tabs
    if (tab !== 'books') {
      setOpenAddBookForm(false);
    }
    if (tab !== 'students') {
      setOpenAddStudentForm(false);
    }
    if (tab !== 'borrowing') {
      setBorrowingInitialTab('overview');
    }
    if (tab !== 'admin') {
      setAdminInitialTab('overview');
    }
  };

  // Enhanced quick action handler for direct navigation
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'addBook':
        setOpenAddBookForm(true);
        handleTabChange('books');
        break;
      case 'addStudent':
        setOpenAddStudentForm(true);
        handleTabChange('students');
        break;
      case 'processReturn':
        setBorrowingInitialTab('returns');
        handleTabChange('borrowing');
        break;
      case 'academicTerms':
        setAdminInitialTab('calendar');
        handleTabChange('admin');
        break;
      case 'systemSettings':
        setAdminInitialTab('settings');
        handleTabChange('admin');
        break;
      default:
        handleTabChange(action as TabType);
    }
  };

  // Search navigation handlers


  const handleBackToMain = () => {
    setSelectedStudent(null);
    setSelectedBook(null);
    setSelectedBorrowing(null);
  };

  return (
    <TooltipProvider>
      <WindowsContextMenu className="app-viewport bg-gray-50 flex">
        <div className="flex w-full h-full">
          {/* Mobile Sidebar Overlay */}
          {sidebarOpen && (
            <div 
              className="absolute inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Simplified Left Sidebar */}
          <div className={`
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0 transition-transform duration-300 ease-in-out
            lg:static inset-y-0 left-0 z-30
            w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col h-full
          `}>
            {/* Simplified Sidebar Header */}
            <div className="p-6 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Search className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">
                      {settingsLoading ? 'Loading...' : schoolName}
                    </h1>
                    <p className="text-xs text-gray-600">Library Management</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden hover:bg-gray-100"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Simplified Navigation Menu */}
            <nav className="flex-1 p-4">
              <div className="space-y-1">
                <button
                  onClick={() => handleTabChange('overview')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === 'overview'
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <BarChart3 className={`w-5 h-5 ${activeTab === 'overview' ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span className="font-medium">Overview</span>
                </button>

                <button
                  onClick={() => handleTabChange('books')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === 'books'
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <BookOpen className={`w-5 h-5 ${activeTab === 'books' ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span className="font-medium">Books</span>
                </button>

                <button
                  onClick={() => handleTabChange('students')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === 'students'
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Users className={`w-5 h-5 ${activeTab === 'students' ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span className="font-medium">Students</span>
                </button>

                <button
                  onClick={() => handleTabChange('staff')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === 'staff'
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <User className={`w-5 h-5 ${activeTab === 'staff' ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span className="font-medium">Staff</span>
                </button>

                <button
                  onClick={() => handleTabChange('borrowing')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === 'borrowing'
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <FileText className={`w-5 h-5 ${activeTab === 'borrowing' ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span className="font-medium">Borrowing</span>
                </button>

                <button
                  onClick={() => handleTabChange('reports')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === 'reports'
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <BarChart3 className={`w-5 h-5 ${activeTab === 'reports' ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span className="font-medium">Reports</span>
                </button>

                <button
                  onClick={() => handleTabChange('profile')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === 'profile'
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <User className={`w-5 h-5 ${activeTab === 'profile' ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span className="font-medium">Profile</span>
                </button>

                <button
                  onClick={() => handleTabChange('sync')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === 'sync'
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <RefreshCw className={`w-5 h-5 ${activeTab === 'sync' ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span className="font-medium">Sync</span>
                </button>



                {isAdmin && (
                  <>
                    <div className="my-4 border-t border-gray-200"></div>
                    <div className="px-4 py-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Administration
                      </span>
                    </div>
                    <button
                      onClick={() => handleTabChange('admin')}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                        activeTab === 'admin'
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Crown className={`w-5 h-5 ${activeTab === 'admin' ? 'text-blue-600' : 'text-gray-500'}`} />
                      <span className="font-medium">Admin Panel</span>
                      {isAdmin && (
                        <Badge variant="secondary" className="ml-auto text-xs bg-gray-100 text-gray-600">
                          Admin
                        </Badge>
                      )}
                    </button>
                  </>
                )}
              </div>
            </nav>
          </div>
          {/* keep flex container open for main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header with connection status, and profile */}
            <div className="flex justify-between items-center p-4 bg-white border-b border-gray-200">
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-semibold text-gray-900 capitalize">{activeTab}</h2>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Connection Status */}
                <ConnectionStatus showDetails={false} />
                
                {/* Sync Status */}
                <SyncStatusIndicator showDetails={false} />
                
                {/* Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{userInitials}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{userName}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleTabChange('profile')}>
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            {/* Content Container */}
            <div className="flex-1 p-6 overflow-auto min-h-[calc(100vh-4rem)]">
              <div className="max-w-7xl mx-auto">
                {/* Tab Content - Show detail views when items are selected */}
                {selectedStudent && (
                  <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <StudentDetails 
                      student={selectedStudent} 
                      onBack={handleBackToMain}
                    />
                  </div>
                )}
                
                {selectedBook && (
                  <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <BookDetails 
                      book={selectedBook} 
                      onClose={handleBackToMain}
                    />
                  </div>
                )}
                
                {selectedBorrowing && (
                  <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <BorrowingDetails 
                      borrowing={selectedBorrowing} 
                      onBack={handleBackToMain}
                      onUpdate={() => {
                        // Refresh borrowing data if needed
                      }}
                    />
                  </div>
                )}
                
                {/* Main Tab Content */}
                {!selectedStudent && !selectedBook && !selectedBorrowing && (
                  <div className="space-y-6">
                    {activeTab === 'overview' && (
                      <DashboardOverview 
                        onTabChange={handleTabChange}
                        onQuickAction={handleQuickAction}
                      />
                    )}
                    {activeTab === 'books' && (
                      <BookManagement 
                        searchTerm=""
                        openAddBookForm={openAddBookForm}
                      />
                    )}
                    {activeTab === 'students' && (
                      <StudentManagement 
                        openAddStudentForm={openAddStudentForm}
                      />
                    )}
                    {activeTab === 'staff' && (
                      <StaffManagement 
                      />
                    )}
                    {activeTab === 'borrowing' && (
                      <BorrowingManagement 
                        initialTab={borrowingInitialTab}
                      />
                    )}
                    {activeTab === 'reports' && (
                      <Reports />
                    )}
                    {activeTab === 'profile' && (
                      <ProfileForm />
                    )}
                    {activeTab === 'admin' && (
                      <AdminPanel 
                        initialTab={adminInitialTab}
                      />
                    )}
                    {activeTab === 'sync' && (
                      <ProfessionalSyncPanel />
                    )}

                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </WindowsContextMenu>
    </TooltipProvider>
  );
};
