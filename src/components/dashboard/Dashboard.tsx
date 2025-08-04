
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Settings, Crown, User, LogOut, BookOpen, Users, FileText, BarChart3, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
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
import { useProfile } from '@/hooks/useProfile';
import { useOfflineAuth } from '@/hooks/useOfflineAuth';
import { useSystemSettings, getSchoolNameFromSettings } from '@/hooks/useSystemSettings';
import { GlobalSearchBar } from '@/components/search/GlobalSearchBar';
import ConnectionStatus from '@/components/ConnectionStatus';
import { SyncActionBar } from '@/components/SyncActionBar';

export type TabType = 'overview' | 'books' | 'students' | 'staff' | 'borrowing' | 'reports' | 'dashboard' | 'profile' | 'admin';

export const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
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
    
    // Clear search term when changing tabs
    setSearchTerm('');
    
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
  const handleStudentSelect = (student: any) => {
    setSelectedStudent(student);
    setSelectedBook(null);
    setSelectedBorrowing(null);
  };

  const handleBookSelect = (book: any) => {
    setSelectedBook(book);
    setSelectedStudent(null);
    setSelectedBorrowing(null);
  };

  const handleBorrowingSelect = (borrowing: any) => {
    setSelectedBorrowing(borrowing);
    setSelectedStudent(null);
    setSelectedBook(null);
  };

  const handleBackToMain = () => {
    setSelectedStudent(null);
    setSelectedBook(null);
    setSelectedBorrowing(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Simplified background - no pattern overlay */}
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Simplified Left Sidebar */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 transition-transform duration-300 ease-in-out
        fixed lg:static inset-y-0 left-0 z-30
        w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {/* Simplified Top Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 lg:space-x-6 min-w-0 flex-1">
              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden hover:bg-gray-100 flex-shrink-0"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              
              <div className="flex items-center space-x-3 lg:space-x-4 min-w-0">
                {/* Simple Icon based on active tab */}
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  {activeTab === 'overview' && <BarChart3 className="w-5 h-5 lg:w-6 lg:h-6 text-white" />}
                  {activeTab === 'books' && <BookOpen className="w-5 h-5 lg:w-6 lg:h-6 text-white" />}
                  {activeTab === 'students' && <Users className="w-5 h-5 lg:w-6 lg:h-6 text-white" />}
                  {activeTab === 'staff' && <User className="w-5 h-5 lg:w-6 lg:h-6 text-white" />}
                  {activeTab === 'borrowing' && <FileText className="w-5 h-5 lg:w-6 lg:h-6 text-white" />}
                  {activeTab === 'reports' && <BarChart3 className="w-5 h-5 lg:w-6 lg:h-6 text-white" />}
                  {activeTab === 'profile' && <User className="w-5 h-5 lg:w-6 lg:h-6 text-white" />}
                  {activeTab === 'admin' && <Crown className="w-5 h-5 lg:w-6 lg:h-6 text-white" />}
                </div>
                
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl lg:text-2xl font-bold text-gray-900 capitalize truncate">
                    {activeTab === 'admin' ? 'Administration' : activeTab}
                  </h2>
                  <p className="text-sm lg:text-base text-gray-600 hidden sm:block">
                    {activeTab === 'overview' && `Welcome back to ${schoolName}! Here's what's happening in your library today.`}
                    {activeTab === 'books' && 'Manage your book collection and inventory.'}
                    {activeTab === 'students' && 'Manage student records and information.'}
                    {activeTab === 'staff' && 'Manage staff records and information.'}
                    {activeTab === 'borrowing' && 'Handle book loans and returns.'}
                    {activeTab === 'reports' && 'Generate reports and view analytics.'}
                    {activeTab === 'admin' && 'System administration and user management.'}
                    {activeTab === 'profile' && 'Update your personal information and settings.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Enhanced Global Search Bar */}
            <div className="hidden md:flex flex-1 max-w-lg mx-4 lg:mx-8">
              <GlobalSearchBar
                value={searchTerm}
                onSearchTermChange={setSearchTerm}
                onStudentSelect={handleStudentSelect}
                onBookSelect={handleBookSelect}
                onBorrowingSelect={handleBorrowingSelect}
                placeholder="Search books, students, or borrowings..."
                className="w-full"
              />
            </div>

            {/* Simplified Quick Actions with Profile */}
            <div className="flex items-center space-x-2 lg:space-x-4 flex-shrink-0">
              {/* User Profile Info with Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center space-x-2 lg:space-x-3 bg-white rounded-lg px-3 lg:px-4 py-2 border border-gray-300 hover:bg-gray-50 transition-colors">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:flex flex-col text-left min-w-0">
                      <span className="text-sm font-medium text-gray-900 leading-tight truncate">
                        {userName.length > 12 ? `${userName.substring(0, 12)}...` : userName}
                      </span>
                      <div className="flex items-center space-x-1">
                        <Badge variant={isAdmin ? "default" : "secondary"} className="text-xs h-4">
                          {isAdmin && <Crown className="w-2 h-2 mr-1" />}
                          {userRole}
                        </Badge>
                      </div>
                    </div>
                    <Settings className="w-4 h-4 text-gray-400 hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{userName}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {(profile as any)?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleTabChange('profile')} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Connection Status */}
              <div className="hidden lg:block">
                <ConnectionStatus showDetails={false} />
              </div>
            </div>
          </div>

          {/* Connection Status Panel for smaller screens */}
          <div className="lg:hidden mt-3 pt-3 border-t border-gray-200">
            <ConnectionStatus showDetails={true} />
          </div>

          {/* Mobile Enhanced Search Bar */}
          <div className="md:hidden mt-4">
            <GlobalSearchBar
              value={searchTerm}
              onSearchTermChange={setSearchTerm}
              onStudentSelect={handleStudentSelect}
              onBookSelect={handleBookSelect}
              onBorrowingSelect={handleBorrowingSelect}
              placeholder="Search..."
              className="w-full"
            />
          </div>
        </div>

        {/* Simplified Page Content */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Content Container */}
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
            
            {/* Regular tab content - show when no detail view is selected */}
            {!selectedStudent && !selectedBook && !selectedBorrowing && (
              <>
                {activeTab === 'overview' && (
                  <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <DashboardOverview onTabChange={handleTabChange} onQuickAction={handleQuickAction} />
                  </div>
                )}
                
                {activeTab === 'books' && (
                  <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <BookManagement searchTerm={searchTerm} openAddBookForm={openAddBookForm} />
                  </div>
                )}
                
                {activeTab === 'students' && (
                  <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <StudentManagement openAddStudentForm={openAddStudentForm} />
                  </div>
                )}

                {activeTab === 'staff' && (
                  <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <StaffManagement />
                  </div>
                )}
                
                {activeTab === 'borrowing' && (
                  <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <BorrowingManagement initialTab={borrowingInitialTab} />
                  </div>
                )}
                
                {activeTab === 'reports' && (
                  <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <Reports />
                  </div>
                )}
                
                {activeTab === 'profile' && (
                  <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <div className="max-w-2xl mx-auto">
                      <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <User className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                          Profile Settings
                        </h1>
                        <p className="text-gray-600">Manage your personal information and account preferences</p>
                      </div>
                      <ProfileForm />
                    </div>
                  </div>
                )}
                
                {activeTab === 'admin' && isAdmin && (
                  <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <AdminPanel initialTab={adminInitialTab} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Professional Sync Action Bar */}
      <SyncActionBar />
    </div>
  );
};
