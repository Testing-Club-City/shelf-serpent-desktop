
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Book, Users, FileText, Calendar, Loader2, Crown, Settings, BarChart3, GraduationCap } from 'lucide-react';
import { useBooks } from '@/hooks/useBooks';
import { useOptimizedStudents } from '@/hooks/useOptimizedStudents';
import { useOptimizedBorrowings, useBorrowingStatistics } from '@/hooks/useOptimizedBorrowings';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import type { TabType } from './Dashboard';

interface DashboardOverviewProps {
  onTabChange: (tab: TabType) => void;
  onQuickAction: (action: string) => void;
}

export const DashboardOverview = ({ onTabChange, onQuickAction }: DashboardOverviewProps) => {
  const { data: books, isLoading: booksLoading } = useBooks();
  // Get total count of students without pagination
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-total-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    }
  });
  
  const { data: borrowingStats, isLoading: borrowingStatsLoading } = useBorrowingStatistics();
  const { data: profile } = useProfile();
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  // Get user role
  const userRole = (profile as any)?.role || 'librarian';
  const isAdmin = userRole === 'admin';
  const userName = `${(profile as any)?.first_name || ''} ${(profile as any)?.last_name || ''}`.trim() || 'User';

  // Calculate stats using optimized data
  const totalBooks = books?.length || 0;
  const totalStudents = studentsData || 0;
  const activeBorrowings = borrowingStats?.active || 0;
  const overdueBorrowings = borrowingStats?.overdue || 0;

  // Prepare stats cards data
  const stats = [
    {
      title: 'Total Books',
      value: totalBooks.toString(),
      change: totalBooks > 0 ? '+' : '',
      icon: Book,
      color: 'bg-blue-500',
      isLoading: booksLoading,
    },
    {
      title: 'Total Students',
      value: totalStudents.toString(),
      change: totalStudents > 0 ? '+' : '',
      icon: Users,
      color: 'bg-green-500',
      isLoading: studentsLoading,
    },
    {
      title: 'Active Borrowings',
      value: activeBorrowings.toString(),
      change: activeBorrowings > 0 ? '+' : '',
      icon: FileText,
      color: 'bg-orange-500',
      isLoading: borrowingStatsLoading,
    },
    {
      title: 'Overdue Books',
      value: overdueBorrowings.toString(),
      change: overdueBorrowings > 0 ? '' : '-',
      icon: Calendar,
      color: 'bg-red-500',
      isLoading: borrowingStatsLoading,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening in your library today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden">
              <CardContent className="p-6">
                {stat.isLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                      <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Academic Year Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {borrowingStatsLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50">
                  <div className="flex items-center space-x-3">
                    <Book className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">Total Borrowings</p>
                      <p className="text-sm text-gray-600">All time records</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {borrowingStats?.total || 0}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="font-medium text-gray-900">Returned Books</p>
                      <p className="text-sm text-gray-600">Successfully returned</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {borrowingStats?.returned || 0}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-red-50">
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-8 h-8 text-red-600" />
                    <div>
                      <p className="font-medium text-gray-900">Lost Books</p>
                      <p className="text-sm text-gray-600">Reported as lost</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-red-600">
                    {borrowingStats?.lost || 0}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <button
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
                onClick={() => onQuickAction('addBook')}
              >
                <Book className="w-8 h-8 text-blue-600 mb-2" />
                <p className="font-medium text-gray-900">Add New Book</p>
                <p className="text-sm text-gray-600">Register a new book</p>
              </button>
              
              <button
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
                onClick={() => onQuickAction('addStudent')}
              >
                <Users className="w-8 h-8 text-green-600 mb-2" />
                <p className="font-medium text-gray-900">Add Student</p>
                <p className="text-sm text-gray-600">Register new student</p>
              </button>
              
              <button
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
                onClick={() => onQuickAction('processReturn')}
              >
                <FileText className="w-8 h-8 text-orange-600 mb-2" />
                <p className="font-medium text-gray-900">Process Return</p>
                <p className="text-sm text-gray-600">Mark book as returned</p>
              </button>
              
              {isAdmin && (
                <button
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
                  onClick={() => onQuickAction('academicTerms')}
                >
                  <GraduationCap className="w-8 h-8 text-purple-600 mb-2" />
                  <p className="font-medium text-gray-900">Academic Terms</p>
                  <p className="text-sm text-gray-600">Manage school calendar</p>
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Crown className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-purple-900">Administrator Controls</CardTitle>
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                Admin Only
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                className="p-4 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 text-left transition-colors"
                onClick={() => onQuickAction('academicTerms')}
              >
                <GraduationCap className="w-8 h-8 text-purple-600 mb-2" />
                <p className="font-medium text-gray-900">Academic Calendar</p>
                <p className="text-sm text-gray-600">Manage terms and promotions</p>
              </button>
              <button
                className="p-4 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 text-left transition-colors"
                onClick={() => onQuickAction('systemSettings')}
              >
                <Settings className="w-8 h-8 text-purple-600 mb-2" />
                <p className="font-medium text-gray-900">System Settings</p>
                <p className="text-sm text-gray-600">Configure library preferences</p>
              </button>
              <button
                className="p-4 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 text-left transition-colors"
                onClick={() => onTabChange('reports')}
              >
                <BarChart3 className="w-8 h-8 text-purple-600 mb-2" />
                <p className="font-medium text-gray-900">Advanced Reports</p>
                <p className="text-sm text-gray-600">System analytics and logs</p>
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
