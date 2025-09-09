import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Download, 
  Calendar, 
  TrendingUp, 
  Filter, 
  Users, 
  BookOpen,
  BarChart3,
  PieChart,
  AlertCircle,
  Clock,
  Target,
  Currency,
  BookX,
  Shield,
  UsersRound
} from 'lucide-react';

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  category: 'books' | 'students' | 'staff' | 'analytics';
  complexity: 'basic' | 'intermediate' | 'advanced';
  estimatedTime: string;
}

interface ReportGeneratorProps {
  onGenerateReport: (reportType: string) => void;
  selectedClass: string;
  selectedDateRange: string;
  availableClasses: any[];
  stats: {
    totalBooks: number;
    totalStudentsInClass: number;
    activeBorrowings: number;
    overdueCount: number;
  };
}

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  onGenerateReport,
  selectedClass,
  selectedDateRange,
  availableClasses,
  stats
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedComplexity, setSelectedComplexity] = useState<string>('all');

  const reportTypes: ReportType[] = [
    {
      id: 'borrowing_history',
      title: 'Borrowing History',
      description: 'Complete history of all book borrowings and returns with detailed tracking',
      icon: FileText,
      color: 'bg-blue-500',
      category: 'books',
      complexity: 'basic',
      estimatedTime: '2-3 min'
    },
    {
      id: 'overdue_books',
      title: 'Overdue Books Report',
      description: 'Critical report of all books currently overdue for return',
      icon: AlertCircle,
      color: 'bg-red-500',
      category: 'books',
      complexity: 'basic',
      estimatedTime: '1-2 min'
    },
    {
      id: 'popular_books',
      title: 'Popular Books Analytics',
      description: 'Data-driven analysis of most frequently borrowed books',
      icon: TrendingUp,
      color: 'bg-green-500',
      category: 'analytics',
      complexity: 'intermediate',
      estimatedTime: '3-4 min'
    },
    {
      id: 'student_activity',
      title: 'Student Activity Report',
      description: 'Comprehensive student borrowing patterns and engagement metrics',
      icon: Users,
      color: 'bg-purple-500',
      category: 'students',
      complexity: 'intermediate',
      estimatedTime: '4-5 min'
    },
    {
      id: 'fine_collection',
      title: 'Fine Collection Report',
      description: 'Financial summary of fines collected from overdue books',
      icon: Currency,
      color: 'bg-amber-500',
      category: 'analytics',
      complexity: 'intermediate',
      estimatedTime: '3-4 min'
    },
    {
      id: 'lost_books',
      title: 'Lost Books Report',
      description: 'Track books that have been reported as lost by students',
      icon: BookX,
      color: 'bg-rose-500',
      category: 'books',
      complexity: 'intermediate',
      estimatedTime: '3-4 min'
    },
    {
      id: 'theft_reports',
      title: 'Theft Reports',
      description: 'Track and manage book theft incidents and investigations',
      icon: Shield,
      color: 'bg-red-600',
      category: 'books',
      complexity: 'advanced',
      estimatedTime: '4-5 min'
    },
    {
      id: 'library_summary',
      title: 'Executive Summary',
      description: 'High-level library performance metrics and KPIs for management',
      icon: BarChart3,
      color: 'bg-orange-500',
      category: 'analytics',
      complexity: 'advanced',
      estimatedTime: '5-6 min'
    },
    {
      id: 'group_borrowings',
      title: 'Group Borrowings',
      description: 'Analyze group borrowing patterns and collaborative reading',
      icon: UsersRound,
      color: 'bg-indigo-500',
      category: 'students',
      complexity: 'advanced',
      estimatedTime: '4-5 min'
    },
    {
      id: 'book_suppliers',
      title: 'Book Suppliers Report',
      description: 'Books organized by supplier type with copy counts',
      icon: Users,
      color: 'bg-teal-500',
      category: 'books',
      complexity: 'basic',
      estimatedTime: '2-3 min'
    },
    {
      id: 'staff_overdue_books',
      title: 'Staff Overdue Books',
      description: 'Books overdue from staff borrowings with fine calculations',
      icon: AlertCircle,
      color: 'bg-red-400',
      category: 'staff',
      complexity: 'basic',
      estimatedTime: '2-3 min'
    },
    {
      id: 'staff_activity',
      title: 'Staff Activity',
      description: 'Track staff borrowing operations and activity patterns',
      icon: Users,
      color: 'bg-teal-500',
      category: 'staff',
      complexity: 'basic',
      estimatedTime: '2-3 min'
    },
    {
      id: 'staff_borrowing_trends',
      title: 'Staff Borrowing Trends',
      description: 'Analyze staff borrowing patterns over time',
      icon: TrendingUp,
      color: 'bg-cyan-500',
      category: 'staff',
      complexity: 'intermediate',
      estimatedTime: '3-4 min'
    },
    {
      id: 'staff_most_borrowed',
      title: 'Staff Most Borrowed Books',
      description: 'Books most frequently borrowed by staff members',
      icon: BookOpen,
      color: 'bg-emerald-500',
      category: 'staff',
      complexity: 'intermediate',
      estimatedTime: '3-4 min'
    },
    {
      id: 'staff_borrowing_history',
      title: 'Staff Borrowing History',
      description: 'Complete borrowing history with book copies for staff',
      icon: Calendar,
      color: 'bg-violet-500',
      category: 'staff',
      complexity: 'basic',
      estimatedTime: '2-3 min'
    }
  ];

  const filteredReports = useMemo(() => {
    return reportTypes.filter(report => {
      const categoryMatch = selectedCategory === 'all' || report.category === selectedCategory;
      const complexityMatch = selectedComplexity === 'all' || report.complexity === selectedComplexity;
      return categoryMatch && complexityMatch;
    });
  }, [selectedCategory, selectedComplexity]);

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'basic': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'books': return BookOpen;
      case 'students': return Users;
      case 'staff': return Users;
      case 'analytics': return BarChart3;
      default: return FileText;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Professional Report Generator</h2>
            <p className="text-gray-600">Generate comprehensive library reports with advanced analytics</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Current Scope</div>
            <div className="font-semibold text-gray-900">
              {selectedClass === 'all' ? 'All Classes' : availableClasses.find(c => c.id === selectedClass)?.name || 'Selected Class'}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-3 border border-green-200">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-gray-600">Books</span>
            </div>
            <div className="text-lg font-bold text-blue-600">{stats.totalBooks || 0}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-green-200">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-gray-600">Students</span>
            </div>
            <div className="text-lg font-bold text-purple-600">{stats.totalStudentsInClass || 0}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-green-200">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-600">Active</span>
            </div>
            <div className="text-lg font-bold text-green-600">{stats.activeBorrowings || 0}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-green-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-gray-600">Overdue</span>
            </div>
            <div className="text-lg font-bold text-red-600">{stats.overdueCount || 0}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Filter by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="books">📚 Books & Collection</SelectItem>
                <SelectItem value="students">👥 Student Reports</SelectItem>
                <SelectItem value="staff">👨‍🏫 Staff Reports</SelectItem>
                <SelectItem value="analytics">📊 Analytics & Insights</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Filter by Complexity</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedComplexity} onValueChange={setSelectedComplexity}>
              <SelectTrigger>
                <SelectValue placeholder="Select complexity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="basic">🟢 Basic Reports</SelectItem>
                <SelectItem value="intermediate">🟡 Intermediate Analysis</SelectItem>
                <SelectItem value="advanced">🔴 Advanced Analytics</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReports.map((report) => {
          const Icon = report.icon;
          const CategoryIcon = getCategoryIcon(report.category);
          
          return (
            <Card key={report.id} className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-transparent hover:border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 ${report.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge className={getComplexityColor(report.complexity)} variant="secondary">
                      {report.complexity}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <CategoryIcon className="w-3 h-3" />
                      {report.category}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{report.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{report.description}</p>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {report.estimatedTime}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {selectedDateRange}
                    </div>
                  </div>
                </div>
                
                <Button 
                  className="w-full mt-4 group-hover:bg-blue-600 group-hover:text-white transition-colors" 
                  variant="outline"
                  onClick={() => onGenerateReport(report.id)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredReports.length === 0 && (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="p-8 text-center">
            <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Reports Found</h3>
            <p className="text-gray-600 mb-4">
              No reports match your current filter criteria.
            </p>
            <Button 
              variant="outline" 
              onClick={() => {
                setSelectedCategory('all');
                setSelectedComplexity('all');
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 rounded-full">
              <PieChart className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Report Generation Tips</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Basic reports</strong> provide essential data and are quick to generate</li>
                <li>• <strong>Intermediate reports</strong> include analysis and trends</li>
                <li>• <strong>Advanced reports</strong> offer comprehensive insights and recommendations</li>
                <li>• All reports are generated in professional PDF format for easy sharing</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};