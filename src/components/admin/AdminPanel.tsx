import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LibrarianManagement } from './LibrarianManagement';
import { SystemSettings } from './SystemSettings';
import { BulkStudentEntry } from './BulkStudentEntry';
import { BulkBookEntry } from './BulkBookEntry';
import { BulkStaffEntry } from '../staff/BulkStaffEntry';
import { GraduatedStudentsManagement } from './GraduatedStudentsManagement';
import { FineSettings } from './FineSettings';
import { ClassManagement } from './ClassManagement';
import { ImprovedSchoolCalendarManagement } from './ImprovedSchoolCalendarManagement';
import { ProfessionalSystemLogs } from './ProfessionalSystemLogs';
import { TestLogsDebug } from './TestLogsDebug';
import { AdminOverview } from './AdminOverview';
import { UserPresenceManagement } from './UserPresenceManagement';
import { DatabaseManagement } from './DatabaseManagement';
import { UserManagement } from './UserManagement';
// DatabaseImport component removed - functionality moved to migration panels
import { 
  Users, 
  Settings, 
  FileText, 
  UserPlus, 
  GraduationCap,
  Currency,
  BookOpen,
  Calendar,
  BarChart3,
  Shield,
  Activity,
  Radio,
  Database,
  Download
} from 'lucide-react';

// Import the migration module
import MigrationModule from './migration/index';
import { StudentMigrationPanel } from './migration/StudentMigrationPanel';
import ProfessionalBorrowingMigrationPanel from './migration/ProfessionalBorrowingMigrationPanel';

interface AdminPanelProps {
  initialTab?: string;
}

export const AdminPanel = ({ initialTab = 'overview' }: AdminPanelProps) => {
  // State for active tab
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set([initialTab]));
  
  // Ensure the tab is valid
  useEffect(() => {
    const validTabs = [
      'overview', 
      'users',
      'librarians', 
      'students', 
      'books', 
      'classes', 
      'graduated',
      'fines',
      'calendar',
      'settings',
      'logs',
      'migration'
    ];
    
    if (!validTabs.includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [activeTab]);

  // Handle tab change with lazy loading
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    // Mark tab as loaded when user switches to it
    setLoadedTabs(prev => new Set([...prev, newTab]));
  };

  // Component wrapper for lazy loading
  const LazyTabContent = ({ tabName, children }: { tabName: string; children: React.ReactNode }) => {
    if (!loadedTabs.has(tabName)) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-pulse bg-gray-200 h-8 w-32 rounded mb-2 mx-auto"></div>
            <p className="text-gray-500">Loading...</p>
          </div>
        </div>
      );
    }
    return <>{children}</>;
  };

  const adminSections = [
    {
      title: "Overview",
      items: [
        {
          name: "Admin Overview",
          icon: <BarChart3 className="h-5 w-5" />,
          component: <AdminOverview />,
          description: "System statistics and quick insights"
        }
      ]
    },
    {
      title: "User Management",
      items: [
        {
          name: "User Management",
          icon: <Shield className="h-5 w-5" />,
          component: <UserManagement />,
          description: "Manage all system users, roles, and passwords"
        },
        {
          name: "User Management",
          icon: <Shield className="h-5 w-5" />,
          component: <UserManagement />,
          description: "Manage all system users, roles, and passwords"
        },
        {
          name: "User Presence",
          icon: <Radio className="h-5 w-5" />,
          component: <UserPresenceManagement />,
          description: "Monitor online users and track user activity"
        }
      ]
    },
    {
      title: "Bulk Entry",
      items: [
        {
          name: "Bulk Student Entry",
          icon: <UserPlus className="h-5 w-5" />,
          component: <BulkStudentEntry />,
          description: "Import students from Excel/CSV files with duplicate detection and validation"
        },
        {
          name: "Bulk Staff Entry",
          icon: <Users className="h-5 w-5" />,
          component: <BulkStaffEntry />,
          description: "Import staff members from Excel/CSV files"
        },
        {
          name: "Bulk Book Entry",
          icon: <BookOpen className="h-5 w-5" />,
          component: <BulkBookEntry />,
          description: "Import books from Excel/CSV files with duplicate detection and validation"
        }
      ]
    },
    {
      title: "Class Management",
      items: [
        {
          name: "Class Management",
          icon: <BookOpen className="h-5 w-5" />,
          component: <ClassManagement />,
          description: "Manage classes, form levels, and student assignments"
        }
      ]
    },
    {
      title: "Graduated Students",
      items: [
        {
          name: "Graduated Students Management",
          icon: <GraduationCap className="h-5 w-5" />,
          component: <GraduatedStudentsManagement />,
          description: "Manage alumni records, outstanding books, and fine collections"
        }
      ]
    },
    {
      title: "Fine Settings",
      items: [
        {
          name: "Fine Settings Management",
          icon: <Currency className="h-5 w-5" />,
          component: <FineSettings />,
          description: "Configure fine amounts for different scenarios including theft, damage, and overdue books"
        }
      ]
    },
    {
      title: "Academic Calendar",
      items: [
        {
          name: "Academic Calendar Management",
          icon: <Calendar className="h-5 w-5" />,
          component: <ImprovedSchoolCalendarManagement />,
          description: "Manage 3-term academic years and student promotions"
        }
      ]
    },
    {
      title: "Class Limits",
      items: [
        {
          name: "Class Limits",
          icon: <Settings className="h-5 w-5" />,
          component: <SystemSettings />,
          description: "Configure borrowing limits per form/grade level"
        }
      ]
    },
    {
      title: "System Logs",
      items: [
        {
          name: "System Activity Logs",
          icon: <Activity className="h-5 w-5" />,
          component: <ProfessionalSystemLogs />,
          description: "Monitor system activities with professional logging interface"
        }
      ]
    },
    {
      title: "Data Management",
      items: [
        {
          name: "Database Management",
          icon: <Database className="h-5 w-5" />,
          component: <DatabaseManagement />,
          description: "Import and replace the current database"
        },
        {
          name: "Legacy Data Migration",
          icon: <Database className="h-5 w-5" />,
          component: <MigrationModule />,
          description: "Import data from your old library system"
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-gray-600 text-lg">Comprehensive system management and configuration</p>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-2">
            <TabsList className="grid w-full grid-cols-11 gap-1">
              <TabsTrigger value="overview" className="flex items-center gap-2 py-3">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="librarians" className="flex items-center gap-2 py-3">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Users</span>
              </TabsTrigger>
              <TabsTrigger value="students" className="flex items-center gap-2 py-3">
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Online</span>
              </TabsTrigger>
              <TabsTrigger value="books" className="flex items-center gap-2 py-3">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Import</span>
              </TabsTrigger>
              <TabsTrigger value="classes" className="flex items-center gap-2 py-3">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Classes</span>
              </TabsTrigger>
              <TabsTrigger value="graduated" className="flex items-center gap-2 py-3">
                <GraduationCap className="h-4 w-4" />
                <span className="hidden sm:inline">Graduated</span>
              </TabsTrigger>
              <TabsTrigger value="fines" className="flex items-center gap-2 py-3">
                <Currency className="h-4 w-4" />
                <span className="hidden sm:inline">Fines</span>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2 py-3">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Calendar</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2 py-3">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Class Limits</span>
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex items-center gap-2 py-3">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Logs</span>
              </TabsTrigger>
              <TabsTrigger value="migration" className="flex items-center gap-2 py-3">
                <Database className="h-4 w-4" />
                <span className="hidden sm:inline">Migration</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Admin Overview */}
          <TabsContent value="overview">
            <Card className="shadow-sm border-0">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Admin Overview</CardTitle>
                    <CardDescription className="text-base">
                      System statistics and quick insights
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <AdminOverview />
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Management */}
          <TabsContent value="librarians">
            <Card className="shadow-sm border-0">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">User Management</CardTitle>
                    <CardDescription className="text-base">
                      Manage all system users, roles, and passwords
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <LazyTabContent tabName="librarians">
                  <UserManagement />
                </LazyTabContent>
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Presence */}
          <TabsContent value="students">
            <Card className="shadow-sm border-0">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Radio className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">User Presence</CardTitle>
                    <CardDescription className="text-base">
                      Monitor online users and track user activity
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <LazyTabContent tabName="students">
                  <UserPresenceManagement />
                </LazyTabContent>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bulk Entry */}
          <TabsContent value="books">
            <Card className="shadow-sm border-0">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Download className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Data Import Center</CardTitle>
                    <CardDescription className="text-base">
                      Import students, staff and books from Excel/CSV files with duplicate detection and validation
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <Tabs defaultValue="students" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="students" className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Student Import
                    </TabsTrigger>
                    <TabsTrigger value="staff" className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Staff Import
                    </TabsTrigger>
                    <TabsTrigger value="books" className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Book Import
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="students">
                    <BulkStudentEntry />
                  </TabsContent>
                  
                  <TabsContent value="staff">
                    <BulkStaffEntry />
                  </TabsContent>
                  
                  <TabsContent value="books">
                    <BulkBookEntry />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Class Management */}
          <TabsContent value="classes">
            <Card className="shadow-sm border-0">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Class Management</CardTitle>
                    <CardDescription className="text-base">
                      Manage classes, form levels, and student assignments
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <ClassManagement />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Graduated Students */}
          <TabsContent value="graduated">
            <Card className="shadow-sm border-0">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Graduated Students Management</CardTitle>
                    <CardDescription className="text-base">
                      Manage alumni records, outstanding books, and fine collections
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <GraduatedStudentsManagement />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fine Settings */}
          <TabsContent value="fines">
            <Card className="shadow-sm border-0">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Currency className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Fine Settings Management</CardTitle>
                    <CardDescription className="text-base">
                      Configure fine amounts for different scenarios including theft, damage, and overdue books
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <FineSettings />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Academic Calendar */}
          <TabsContent value="calendar">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-6 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white border-2 border-slate-300 rounded-lg flex items-center justify-center shadow-sm">
                    <Calendar className="h-6 w-6 text-slate-700" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold text-slate-900">
                      Academic Calendar Management
                    </CardTitle>
                    <CardDescription className="text-base text-slate-600 mt-1">
                      Manage 3-term academic years and student promotions
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <ImprovedSchoolCalendarManagement />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Class Limits */}
          <TabsContent value="settings">
            <Card className="shadow-sm border-0">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Settings className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Class Borrowing Limits</CardTitle>
                    <CardDescription className="text-base">
                      Configure maximum books allowed per form/grade level
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <SystemSettings />
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Logs */}
          <TabsContent value="logs">
            <Card className="shadow-sm border-0">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <Activity className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">System Activity Logs</CardTitle>
                    <CardDescription className="text-base">
                      Monitor system activities with professional logging interface
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {/* Debug Test Component */}
                <div className="mb-6">
                  <TestLogsDebug />
                </div>
                
                {/* Actual Logs Component */}
                <ProfessionalSystemLogs />
              </CardContent>
            </Card>
          </TabsContent>

           {/* Student Migration */}
           <TabsContent value="migration">
             <LazyTabContent tabName="migration">
               {/* Database Management */}
               <Card className="shadow-sm border-0 mb-8">
                 <CardContent className="p-6">
                   <DatabaseManagement />
                 </CardContent>
               </Card>

               <Card className="shadow-sm border-0">
                 <CardHeader className="pb-6">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                       <Database className="h-5 w-5 text-purple-600" />
                     </div>
                     <div>
                       <CardTitle className="text-2xl">Student Migration</CardTitle>
                       <CardDescription className="text-base">
                         Import students with automatic class assignment from your legacy database
                       </CardDescription>
                     </div>
                   </div>
                 </CardHeader>
                 <CardContent className="p-6">
                   <StudentMigrationPanel />
                 </CardContent>
               </Card>

               {/* Borrowing & Fines Migration */}
               <Card className="shadow-sm border-0 mt-8">
                 <CardHeader className="pb-6">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                       <BookOpen className="h-5 w-5 text-green-600" />
                     </div>
                     <div>
                       <CardTitle className="text-2xl">Borrowing & Fines Migration</CardTitle>
                       <CardDescription className="text-base">
                         Import borrowing records and fines from your legacy database
                       </CardDescription>
                     </div>
                   </div>
                 </CardHeader>
                  <CardContent className="p-6">
                    <ProfessionalBorrowingMigrationPanel />
                  </CardContent>
               </Card>
             </LazyTabContent>
           </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
