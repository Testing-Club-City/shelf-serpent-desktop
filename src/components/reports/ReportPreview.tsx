import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

// Utility function to format days overdue in a professional way
const formatDaysOverdue = (days: number): string => {
  if (!days || days <= 0) return '0 days';
  
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const remainingDays = Math.floor(days % 30);
  
  if (years > 0) {
    if (months > 0) {
      return `${years}y ${months}m`;
    }
    return `${years} year${years > 1 ? 's' : ''}`;
  } else if (months > 0) {
    if (remainingDays > 0) {
      return `${months}m ${remainingDays}d`;
    }
    return `${months} month${months > 1 ? 's' : ''}`;
  } else {
    return `${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
  }
};

import {
  Calendar,
  TrendingUp,
  Users,
  BookOpen,
  AlertTriangle,
  BarChart3,
  Activity,
  FileText,
  Download
} from 'lucide-react';

interface ReportPreviewProps {
  data: any;
  reportType: string;
  title: string;
  dateRange: { start: Date; end: Date };
  selectedClass: string;
  onGeneratePDF: () => void;
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({
  data,
  reportType,
  title,
  dateRange,
  selectedClass,
  onGeneratePDF
}) => {
  const [activeTab, setActiveTab] = useState('preview');

  const generatePreviewData = () => {
    if (!data) return { headers: [], rows: [] };

    switch (reportType) {
      case 'borrowing_history':
        const borrowingData = Array.isArray(data.borrowings) ? data.borrowings :
          Array.isArray(data) ? data : [];
        return {
          headers: ['Book Title', 'Admission No.', 'Student Name', 'Class', 'Borrowed', 'Due Date', 'Status'],
          rows: borrowingData.slice(0, 10).map((b: any) => [
            b.book?.title || b.book_title || 'Unknown Book',
            b.student?.admission_number || b.admission_number || 'N/A',
            b.student?.first_name && b.student?.last_name
              ? `${b.student.first_name} ${b.student.last_name}`
              : b.student_name || 'Unknown',
            b.student?.class_grade || b.class_grade || 'Unknown Class',
            new Date(b.borrowed_date || b.created_at).toLocaleDateString(),
            b.due_date ? new Date(b.due_date).toLocaleDateString() : 'N/A',
            b.status || 'active'
          ])
        };

      case 'overdue_books':
        const overdueData = Array.isArray(data.overdueBooks) ? data.overdueBooks :
          Array.isArray(data) ? data : [];
        return {
          headers: ['Book Title', 'Borrower Name', 'Due Date', 'Days Overdue', 'Fine Amount'],
          rows: overdueData.slice(0, 10).map((b: any) => [
            b.books?.title || b.book_title || b.book?.title || 'Unknown Book',
            `${b.students?.first_name || b.staff?.first_name || 'Unknown'} ${b.students?.last_name || b.staff?.last_name || ''}`.trim(),
            b.due_date ? new Date(b.due_date).toLocaleDateString() : 'N/A',
            formatDaysOverdue(b.days_overdue || 0),
            `KSh ${b.fine_amount || 0}`
          ])
        };

      case 'popular_books':
        const popularData = Array.isArray(data.popularBooks) ? data.popularBooks :
          Array.isArray(data) ? data : [];
        return {
          headers: ['Rank', 'Book Title', 'Author', 'Category', 'Times Borrowed'],
          rows: popularData.slice(0, 10).map((b: any, index: number) => [
            index + 1,
            b.book?.title || b.title || 'Unknown Book',
            b.book?.author || b.author || 'Unknown Author',
            b.book?.categories?.name || b.book?.category_name || b.category_name || b.category || 'General',
            b.borrowCount || b.count || 0
          ])
        };

      case 'student_activity':
        const studentData = Array.isArray(data.students) ? data.students :
          Array.isArray(data) ? data : [];
        return {
          headers: ['Admission No.', 'Student Name', 'Class', 'Total Borrowed', 'Currently Borrowed'],
          rows: studentData.slice(0, 10).map((s: any) => [
            s.admission_number || 'N/A',
            s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : 'Unknown',
            s.class_grade || 'Unknown Class',
            s.totalBorrowed || 0,
            s.currentlyBorrowed || 0
          ])
        };

      case 'fine_collection':
        const fineData = Array.isArray(data.fines) ? data.fines :
          Array.isArray(data) ? data : [];
        return {
          headers: ['Class', 'Student Name', 'Admission No.', 'Book Title', 'Fine Amount', 'Status'],
          rows: fineData.slice(0, 10).map((f: any) => [
            f.student?.class_grade || 'Unknown Class',
            f.student?.first_name && f.student?.last_name
              ? `${f.student.first_name} ${f.student.last_name}`
              : 'Unknown',
            f.student?.admission_number || 'N/A',
            f.book?.title || 'Unknown Book',
            `$${f.amount || 0}`,
            f.status || 'unpaid'
          ])
        };

      case 'staff_overdue_books':
        const staffOverdueData = Array.isArray(data.overdueBooks) ? data.overdueBooks :
          Array.isArray(data) ? data : [];
        return {
          headers: ['Staff Name', 'Department', 'Position', 'Book Title', 'Due Date', 'Days Overdue', 'Fine Amount'],
          rows: staffOverdueData.slice(0, 10).map((b: any) => [
            `${b.staff?.first_name || 'Unknown'} ${b.staff?.last_name || 'Staff'}`,
            b.staff?.department || 'General',
            b.staff?.position || 'N/A',
            b.book_title || 'Unknown Book',
            b.due_date ? new Date(b.due_date).toLocaleDateString() : 'N/A',
            b.days_overdue || 0,
            `KSh ${b.fine_amount || 0}`
          ])
        };

      case 'staff_activity':
        const staffActivityData = Array.isArray(data.staffActivity) ? data.staffActivity :
          Array.isArray(data) ? data : [];
        return {
          headers: ['Staff Name', 'Department', 'Total Borrowed', 'Active Loans', 'Returned Books', 'Overdue Books'],
          rows: staffActivityData.slice(0, 10).map((s: any) => [
            `${s.staff?.first_name || 'Unknown'} ${s.staff?.last_name || 'Staff'}`,
            s.staff?.department || 'General',
            s.total_borrowings || 0,
            s.active_borrowings || 0,
            s.returned_borrowings || 0,
            s.overdue_borrowings || 0
          ])
        };

      case 'staff_borrowing_trends':
        const staffTrendsData = Array.isArray(data.staffTrends) ? data.staffTrends :
          Array.isArray(data) ? data : [];
        return {
          headers: ['Date', 'Total Borrowings', 'Unique Staff', 'Returned Same Day', 'Avg Duration'],
          rows: staffTrendsData.slice(0, 10).map((s: any) => [
            s.date || 'N/A',
            s.total_borrowings || 0,
            s.unique_staff || 0,
            s.returned_same_day || 0,
            s.avg_duration_days ? `${s.avg_duration_days.toFixed(1)} days` : 'N/A'
          ])
        };

      case 'staff_most_borrowed':
        const staffMostBorrowedData = Array.isArray(data.staffMostBorrowed) ? data.staffMostBorrowed :
          Array.isArray(data) ? data : [];
        return {
          headers: ['Book Title', 'Author', 'ISBN', 'Publisher', 'Borrow Count', 'Unique Staff', 'Last Borrowed'],
          rows: staffMostBorrowedData.slice(0, 10).map((s: any) => [
            s.book_title || 'Unknown Book',
            s.book_author || 'Unknown Author',
            s.isbn || 'N/A',
            s.publisher || 'N/A',
            s.borrow_count || 0,
            s.unique_staff_borrowers || 0,
            s.last_borrowed ? new Date(s.last_borrowed).toLocaleDateString() : 'N/A'
          ])
        };

      case 'staff_borrowing_history':
        const staffHistoryData = Array.isArray(data.staffHistory) ? data.staffHistory :
          Array.isArray(data) ? data : [];
        return {
          headers: ['Staff Name', 'Department', 'Book Title', 'Copy ID', 'Borrowed Date', 'Due Date', 'Status'],
          rows: staffHistoryData.slice(0, 10).map((b: any) => [
            `${b.staff_first_name || 'Unknown'} ${b.staff_last_name || 'Staff'}`,
            b.department || 'General',
            b.book_title || 'Unknown Book',
            b.copy_identifier || 'N/A',
            b.borrowed_date ? new Date(b.borrowed_date).toLocaleDateString() : 'N/A',
            b.due_date ? new Date(b.due_date).toLocaleDateString() : 'N/A',
            b.status || 'active'
          ])
        };

      default:
        return { headers: [], rows: [] };
    }
  };

  const generateSummaryStats = () => {
    if (!data) return [];

    switch (reportType) {
      case 'borrowing_history':
        return [
          { label: 'Total Records', value: data.totalBorrowings || (data.borrowings?.length || 0), icon: BookOpen },
          { label: 'Active Borrowings', value: data.activeBorrowings || 0, icon: TrendingUp },
          { label: 'Returned Books', value: data.returnedBooks || 0, icon: Users },
          { label: 'Students Involved', value: data.studentsInvolved || 0, icon: Users }
        ];

      case 'overdue_books':
        const overdueBooks = data.overdueBooks || [];
        const uniqueStudents = new Set(overdueBooks.map((b: any) => 
          b.students?.id || b.student?.id || b.student_id
        ).filter(Boolean)).size;
        const avgDaysOverdue = overdueBooks.length > 0 
          ? Math.round(overdueBooks.reduce((sum: number, b: any) => sum + (b.days_overdue || 0), 0) / overdueBooks.length)
          : 0;
        
        return [
          { label: 'Overdue Books', value: overdueBooks.length, icon: AlertTriangle },
          { label: 'Students Affected', value: uniqueStudents, icon: Users },
          { label: 'Average Days Overdue', value: avgDaysOverdue, icon: Calendar }
        ];

      case 'popular_books':
        return [
          { label: 'Total Books', value: data.totalBooks || (data.popularBooks?.length || 0), icon: BookOpen },
          { label: 'Total Borrowings', value: data.totalBorrowings || 0, icon: TrendingUp },
          { label: 'Most Popular', value: data.popularBooks?.[0]?.book?.title || 'N/A', icon: Users }
        ];

      case 'student_activity':
        return [
          { label: 'Active Students', value: data.activeStudents || (data.students?.length || 0), icon: Users },
          { label: 'Total Borrowings', value: data.totalBorrowings || 0, icon: BookOpen },
          { label: 'Average per Student', value: data.avgPerStudent || 0, icon: TrendingUp }
        ];

      case 'staff_overdue_books':
        const overdueStaffBooks = data.overdueBooks || [];
        return [
          { label: 'Overdue Books', value: overdueStaffBooks.length, icon: AlertTriangle },
          { label: 'Staff Affected', value: new Set(overdueStaffBooks.map((b: any) => b.staff?.first_name + ' ' + b.staff?.last_name).filter(Boolean)).size, icon: Users },
          { label: 'Total Fine Amount', value: `KSh ${overdueStaffBooks.reduce((sum: number, b: any) => sum + (b.fine_amount || 0), 0)}`, icon: Calendar }
        ];

      case 'staff_activity':
        const staffActivityData = data.staffActivity || [];
        const totalStaffBorrowings = staffActivityData.reduce((sum: number, s: any) => sum + (s.total_borrowings || 0), 0);
        const activeStaffBorrowings = staffActivityData.reduce((sum: number, s: any) => sum + (s.active_borrowings || 0), 0);
        return [
          { label: 'Active Staff', value: staffActivityData.length, icon: Users },
          { label: 'Total Borrowings', value: totalStaffBorrowings, icon: BookOpen },
          { label: 'Active Loans', value: activeStaffBorrowings, icon: TrendingUp },
          { label: 'Avg per Staff', value: Math.round(totalStaffBorrowings / staffActivityData.length) || 0, icon: Activity }
        ];

      case 'staff_borrowing_trends':
        const staffTrendsData = data.staffTrends || [];
        const totalTrendBorrowings = staffTrendsData.reduce((sum: number, s: any) => sum + (s.total_borrowings || 0), 0);
        return [
          { label: 'Time Periods', value: staffTrendsData.length, icon: Calendar },
          { label: 'Total Borrowings', value: totalTrendBorrowings, icon: BookOpen },
          { label: 'Unique Staff', value: staffTrendsData.reduce((sum: number, s: any) => sum + (s.unique_staff || 0), 0), icon: Users },
          { label: 'Avg Duration', value: `${(staffTrendsData.reduce((sum: number, s: any) => sum + (s.avg_duration_days || 0), 0) / staffTrendsData.length || 0).toFixed(1)} days`, icon: TrendingUp }
        ];

      case 'staff_most_borrowed':
        const staffMostBorrowedData = data.staffMostBorrowed || [];
        const staffTotalBorrowCount = staffMostBorrowedData.reduce((sum: number, s: any) => sum + (s.borrow_count || 0), 0);
        const uniqueStaffBorrowers = staffMostBorrowedData.reduce((sum: number, s: any) => sum + (s.unique_staff_borrowers || 0), 0);
        return [
          { label: 'Popular Books', value: staffMostBorrowedData.length, icon: BookOpen },
          { label: 'Total Borrows', value: staffTotalBorrowCount, icon: TrendingUp },
          { label: 'Staff Borrowers', value: uniqueStaffBorrowers, icon: Users },
          { label: 'Top Book Borrows', value: staffMostBorrowedData[0]?.borrow_count || 0, icon: Activity }
        ];

      case 'staff_borrowing_history':
        const staffHistoryData = data.staffHistory || [];
        const activeHistoryBorrowings = staffHistoryData.filter((b: any) => b.status === 'active').length;
        const uniqueStaffInHistory = new Set(staffHistoryData.map((b: any) => b.staff_id)).size;
        return [
          { label: 'Total Records', value: staffHistoryData.length, icon: FileText },
          { label: 'Active Borrowings', value: activeHistoryBorrowings, icon: TrendingUp },
          { label: 'Staff Members', value: uniqueStaffInHistory, icon: Users },
          { label: 'Returned Books', value: staffHistoryData.filter((b: any) => b.status === 'returned').length, icon: BookOpen }
        ];

      default:
        return [];
    }
  };

  const generateChartData = () => {
    switch (reportType) {
      case 'borrowing_history':
        const statusData = (data.borrowings || []).reduce((acc: any, b: any) => {
          acc[b.status || 'active'] = (acc[b.status || 'active'] || 0) + 1;
          return acc;
        }, {});

        const classData = (data.borrowings || []).reduce((acc: any, b: any) => {
          const className = b.student?.class_grade || 'Unknown';
          acc[className] = (acc[className] || 0) + 1;
          return acc;
        }, {});

        return [
          {
            title: 'Borrowing Status Distribution',
            type: 'pie',
            data: Object.entries(statusData).map(([key, value]) => ({ label: key, value })),
            colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
          },
          {
            title: 'Borrowings by Class',
            type: 'bar',
            data: Object.entries(classData).map(([key, value]) => ({ label: key, value })),
            colors: ['#8b5cf6']
          }
        ];

      case 'overdue_books':
        const overdueClassData = (data.overdueBooks || []).reduce((acc: any, b: any) => {
          const className = b.student?.class_grade || 'Unknown';
          acc[className] = (acc[className] || 0) + 1;
          return acc;
        }, {});

        const overdueDaysData = (data.overdueBooks || []).reduce((acc: any, b: any) => {
          const days = b.days_overdue || 0;
          if (days <= 7) acc['1-7 days'] = (acc['1-7 days'] || 0) + 1;
          else if (days <= 14) acc['8-14 days'] = (acc['8-14 days'] || 0) + 1;
          else if (days <= 30) acc['15-30 days'] = (acc['15-30 days'] || 0) + 1;
          else acc['30+ days'] = (acc['30+ days'] || 0) + 1;
          return acc;
        }, {});

        return [
          {
            title: 'Overdue Books by Class',
            type: 'bar',
            data: Object.entries(overdueClassData).map(([key, value]) => ({ label: key, value })),
            colors: ['#ef4444']
          },
          {
            title: 'Days Overdue Distribution',
            type: 'pie',
            data: Object.entries(overdueDaysData).map(([key, value]) => ({ label: key, value })),
            colors: ['#fbbf24', '#f59e0b', '#d97706', '#b45309']
          }
        ];

      case 'popular_books':
        return [
          {
            title: 'Top 10 Most Borrowed Books',
            type: 'bar',
            data: (data.popularBooks || []).slice(0, 10).map((book: any) => ({
              label: book.book?.title || book.title || 'Unknown',
              value: book.borrowCount || book.count || 0
            })),
            colors: ['#10b981']
          }
        ];

      case 'student_activity':
        const activityClassData = (data.students || []).reduce((acc: any, s: any) => {
          const className = s.class_grade || 'Unknown';
          acc[className] = (acc[className] || 0) + (s.totalBorrowed || 0);
          return acc;
        }, {});

        const engagementData = (data.students || []).reduce((acc: any, s: any) => {
          const total = s.totalBorrowed || 0;
          if (total >= 5) acc['Highly Active (5+)'] = (acc['Highly Active (5+)'] || 0) + 1;
          else if (total >= 2) acc['Moderate (2-4)'] = (acc['Moderate (2-4)'] || 0) + 1;
          else acc['Low (0-1)'] = (acc['Low (0-1)'] || 0) + 1;
          return acc;
        }, {});

        return [
          {
            title: 'Total Borrowings by Class',
            type: 'bar',
            data: Object.entries(activityClassData).map(([key, value]) => ({ label: key, value })),
            colors: ['#8b5cf6']
          },
          {
            title: 'Student Engagement Levels',
            type: 'pie',
            data: Object.entries(engagementData).map(([key, value]) => ({ label: key, value })),
            colors: ['#10b981', '#f59e0b', '#ef4444']
          }
        ];

      default:
        return [];
    }
  };

  const renderVisualizations = () => {
    if (!data) return <div className="text-center text-gray-500">No data available for visualization</div>;

    const chartData = generateChartData();

    return (
      <div className="space-y-6">
        {chartData.map((chart, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {chart.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chart.type === 'bar' && renderBarChart(chart.data, chart.colors)}
              {chart.type === 'pie' && renderPieChart(chart.data, chart.colors)}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderBarChart = (chartData: any[], colors: string[]) => {
    const maxValue = Math.max(...chartData.map(d => d.value));

    return (
      <div className="space-y-2">
        {chartData.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="w-24 text-sm truncate" title={item.label}>
              {item.label}
            </div>
            <div className="flex-1 relative">
              <div className="h-8 bg-gray-200 rounded-md overflow-hidden">
                <div
                  className="h-full transition-all duration-700 ease-out rounded-md"
                  style={{
                    width: `${(item.value / maxValue) * 100}%`,
                    backgroundColor: colors[index % colors.length]
                  }}
                />
              </div>
              <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-medium">
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPieChart = (chartData: any[], colors: string[]) => {
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = 0;

    const segments = chartData.map((item, index) => {
      const percentage = (item.value / total) * 100;
      const angle = (item.value / total) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;

      return { ...item, percentage, angle, startAngle, color: colors[index % colors.length] };
    });

    return (
      <div className="flex items-center gap-6">
        <div className="relative w-48 h-48">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {segments.map((segment, index) => {
              const isLargeArc = segment.angle > 180 ? 1 : 0;
              const x1 = 50 + 40 * Math.cos((segment.startAngle * Math.PI) / 180);
              const y1 = 50 + 40 * Math.sin((segment.startAngle * Math.PI) / 180);
              const x2 = 50 + 40 * Math.cos(((segment.startAngle + segment.angle) * Math.PI) / 180);
              const y2 = 50 + 40 * Math.sin(((segment.startAngle + segment.angle) * Math.PI) / 180);

              const pathData = `M 50 50 L ${x1} ${y1} A 40 40 0 ${isLargeArc} 1 ${x2} ${y2} Z`;

              return (
                <path
                  key={index}
                  d={pathData}
                  fill={segment.color}
                  className="transition-all duration-300 hover:opacity-80"
                />
              );
            })}
          </svg>
        </div>
        <div className="space-y-2">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-sm">
                {segment.label}: {segment.value} ({segment.percentage.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const generateInsights = () => {
    if (!data) return [];

    switch (reportType) {
      case 'borrowing_history':
        const borrowings = data.borrowings || [];
        const totalBorrowings = borrowings.length;
        const activeBorrowings = borrowings.filter((b: any) => b.status === 'active').length;
        const returnRate = totalBorrowings > 0 ? ((totalBorrowings - activeBorrowings) / totalBorrowings * 100).toFixed(1) : 0;

        return [
          `📊 Total of ${totalBorrowings} borrowing records analyzed`,
          `📈 ${activeBorrowings} books currently borrowed (${((activeBorrowings / totalBorrowings) * 100).toFixed(1)}% of total)`,
          `✅ Return rate: ${returnRate}%`,
          totalBorrowings > 1000 ? '💡 High borrowing activity indicates good library engagement' : '💡 Consider promoting library resources to increase usage',
          activeBorrowings > totalBorrowings * 0.3 ? '⚠️ High number of unreturned books - consider follow-up reminders' : '✅ Good return compliance rate'
        ];

      case 'overdue_books':
        const overdueBooks = data.overdueBooks || [];
        const avgDaysOverdue = overdueBooks.reduce((sum: number, book: any) => sum + (book.days_overdue || 0), 0) / overdueBooks.length || 0;
        const criticalOverdue = overdueBooks.filter((b: any) => (b.days_overdue || 0) > 30).length;

        return [
          `⚠️ ${overdueBooks.length} books are currently overdue`,
          `📅 Average overdue period: ${Math.round(avgDaysOverdue)} days`,
          `🚨 ${criticalOverdue} books overdue for more than 30 days`,
          avgDaysOverdue > 14 ? '💡 Consider implementing stricter return policies or more frequent reminders' : '✅ Reasonable overdue periods',
          criticalOverdue > 0 ? '🔥 Immediate action needed for long-overdue items' : '✅ No critically overdue books'
        ];

      case 'popular_books':
        const popularBooks = data.popularBooks || [];
        const mostPopular = popularBooks[0];
        const popularTotalBorrowCount = popularBooks.reduce((sum: number, book: any) => sum + (book.borrowCount || 0), 0);

        return [
          `⭐ "${mostPopular?.book?.title || 'Unknown'}" is the most borrowed book with ${mostPopular?.borrowCount || 0} borrowings`,
          `📚 Top 10 books account for ${popularTotalBorrowCount} total borrowings`,
          `📊 Average borrowings per popular book: ${Math.round(popularTotalBorrowCount / popularBooks.length)}`,
          popularBooks.length < 10 ? '💡 Consider acquiring more copies of popular titles' : '✅ Good variety in popular books',
          '📈 Use this data to guide future book acquisitions'
        ];

      case 'student_activity':
        const students = data.students || [];
        const activeStudents = students.filter((s: any) => (s.totalBorrowed || 0) > 0).length;
        const avgBorrowingsPerStudent = students.reduce((sum: number, s: any) => sum + (s.totalBorrowed || 0), 0) / students.length;
        const highEngagement = students.filter((s: any) => (s.totalBorrowed || 0) >= 5).length;

        return [
          `👥 ${activeStudents} out of ${students.length} students have borrowed books (${((activeStudents / students.length) * 100).toFixed(1)}% engagement)`,
          `📚 Average ${avgBorrowingsPerStudent.toFixed(1)} books borrowed per student`,
          `🌟 ${highEngagement} students are highly engaged (5+ borrowings)`,
          activeStudents / students.length < 0.3 ? '💡 Low engagement - consider reading programs or incentives' : '✅ Good student participation in library programs',
          highEngagement > students.length * 0.1 ? '🎉 Excellent reading culture among students' : '💡 Encourage more students to become regular readers'
        ];

      case 'staff_overdue_books':
        const overdueStaffBooks = data.overdueBooks || [];
        const avgOverdueDays = overdueStaffBooks.reduce((sum: number, b: any) => sum + (b.days_overdue || 0), 0) / overdueStaffBooks.length || 0;
        const totalFines = overdueStaffBooks.reduce((sum: number, b: any) => sum + (b.fine_amount || 0), 0);

        return [
          `⚠️ ${overdueStaffBooks.length} books are overdue from staff borrowings`,
          `📅 Average overdue period: ${Math.round(avgOverdueDays)} days`,
          `� Total afine amount: KSh ${totalFines}`,
          overdueStaffBooks.length === 0 ? '✅ Excellent! No staff overdue books' : '💡 Consider staff reminders for overdue returns',
          avgOverdueDays > 30 ? '🚨 Some books significantly overdue - immediate follow-up needed' : '✅ Reasonable overdue periods'
        ];

      case 'staff_activity':
        const staffActivityData = data.staffActivity || [];
        const totalStaffBorrowings = staffActivityData.reduce((sum: number, s: any) => sum + (s.total_borrowings || 0), 0);
        const avgPerStaff = staffActivityData.length > 0 ? totalStaffBorrowings / staffActivityData.length : 0;
        const highlyActiveStaff = staffActivityData.filter((s: any) => (s.total_borrowings || 0) >= 5).length;

        return [
          `👨‍🏫 ${staffActivityData.length} staff members are active library users`,
          `📚 Total of ${totalStaffBorrowings} books borrowed by staff`,
          `📊 Average ${avgPerStaff.toFixed(1)} books per staff member`,
          `🌟 ${highlyActiveStaff} staff members are highly engaged (5+ borrowings)`,
          avgPerStaff > 3 ? '✅ Excellent staff engagement with library resources' : '💡 Encourage more staff participation in library programs'
        ];

      case 'staff_borrowing_trends':
        const staffTrendsData = data.staffTrends || [];
        const totalTrendBorrowings = staffTrendsData.reduce((sum: number, s: any) => sum + (s.total_borrowings || 0), 0);
        const avgDaily = staffTrendsData.length > 0 ? totalTrendBorrowings / staffTrendsData.length : 0;

        return [
          `📈 Analyzing borrowing trends across ${staffTrendsData.length} time periods`,
          `� TTotal ${totalTrendBorrowings} borrowings analyzed over time`,
          `� Aoverage ${avgDaily.toFixed(1)} borrowings per period`,
          avgDaily > 5 ? '✅ Consistent staff library usage over time' : '💡 Consider programs to encourage more staff reading',
          '📈 Use trend data to plan staff resource acquisition and optimal library hours'
        ];

      case 'staff_most_borrowed':
        const staffMostBorrowedData = data.staffMostBorrowed || [];
        const topBook = staffMostBorrowedData[0];
        const staffMostBorrowedTotalCount = staffMostBorrowedData.reduce((sum: number, s: any) => sum + (s.borrow_count || 0), 0);

        return [
          `📚 "${topBook?.book_title || 'Unknown'}" is the most popular book among staff`,
          `⭐ Top book borrowed ${topBook?.borrow_count || 0} times by staff`,
          `📖 ${staffMostBorrowedData.length} books are popular among staff`,
          `� T{otal ${staffMostBorrowedTotalCount} borrowings across all popular books`,
          '� Use astaff reading preferences to guide professional development resource acquisition'
        ];

      case 'staff_borrowing_history':
        const staffHistoryData = data.staffHistory || [];
        const uniqueStaffInHistory = new Set(staffHistoryData.map((b: any) => b.staff_id)).size;
        const avgPerStaffHistory = uniqueStaffInHistory > 0 ? staffHistoryData.length / uniqueStaffInHistory : 0;

        return [
          `👨‍🏫 Complete borrowing history for ${uniqueStaffInHistory} staff members`,
          `📚 Total of ${staffHistoryData.length} staff borrowing records`,
          `� AveCrage ${avgPerStaffHistory.toFixed(1)} borrowings per staff member`,
          avgPerStaffHistory > 3 ? '✅ Good staff engagement with library resources' : '💡 Encourage staff to utilize library resources more',
          '� Histaorical data reveals staff reading patterns and professional development interests'
        ];

      default:
        return ['No specific insights available for this report type.'];
    }
  };

  const { headers, rows } = generatePreviewData();
  const summaryStats = generateSummaryStats();
  const insights = generateInsights();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">
            {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
            {!reportType.startsWith('staff_') && selectedClass !== 'all' && ` • ${selectedClass}`}
          </p>
        </div>
        <Button
          onClick={() => {
            // Show user-friendly message about popups
            const userAgent = navigator.userAgent;
            if (userAgent.includes('Chrome') || userAgent.includes('Firefox') || userAgent.includes('Safari')) {
              // Most modern browsers will show their own popup blocker notification
            }
            onGeneratePDF();
          }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Download className="w-4 h-4 mr-2" />
          Generate PDF
        </Button>
      </div>

      {summaryStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryStats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="flex items-center p-6">
                <div className="flex items-center">
                  <stat.icon className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Data Preview
          </TabsTrigger>
          <TabsTrigger value="charts" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Visualizations
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Data Preview (First 10 Records)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {headers.map((header, index) => (
                          <th
                            key={index}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rows.map((row: any[], rowIndex: number) => (
                        <tr key={rowIndex} className="hover:bg-gray-50">
                          {row.map((cell: any, cellIndex: number) => (
                            <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {cellIndex === headers.length - 1 && typeof cell === 'string' ? (
                                <Badge variant={
                                  cell === 'active' ? 'default' :
                                    cell === 'returned' ? 'secondary' :
                                      cell === 'overdue' ? 'destructive' : 'outline'
                                }>
                                  {cell}
                                </Badge>
                              ) : (
                                cell
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No data available for preview
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          {renderVisualizations()}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Report Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {insights.map((insight, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                    <div className="text-sm text-gray-700">{insight}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};