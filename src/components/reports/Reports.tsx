import React, { useState, useMemo, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Calendar, TrendingUp, Filter, Users, Currency, BookX, Shield, UsersRound, Settings, BarChart3, AlertCircle } from 'lucide-react';
import { generatePDFReport } from '@/utils/reportGenerator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ReportsSkeleton } from './ReportsSkeleton';
import { ReportGenerator } from './ReportGenerator';
import { ReportPreview } from './ReportPreview';

// Lazy load heavy components
const LostBooksReport = lazy(() => import('./LostBooksReport').then(m => ({ default: m.LostBooksReport })));
const TheftReportsView = lazy(() => import('./TheftReportsView').then(m => ({ default: m.TheftReportsView })));
const GroupBorrowingReport = lazy(() => import('./GroupBorrowingReport').then(m => ({ default: m.GroupBorrowingReport })));

// Import hooks
import { useBorrowings, useFineCollection } from '@/hooks/useBorrowings';
import { useBorrowingsOffline } from '@/hooks/useBorrowingsOffline';
import { useLostBooks } from '@/hooks/useLostBooks';
import { useBooks } from '@/hooks/useBooks';
import { useStudents } from '@/hooks/useStudents';
import { useClassesOffline } from '@/hooks/useClassesOffline';
import { useGroupBorrowings } from '@/hooks/useGroupBorrowings';
import { useGroupBorrowingsOffline } from '@/hooks/useGroupBorrowingsOffline';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_grade: string;
}

interface Staff {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Book {
  id: string;
  title: string;
  author?: string;
  isbn?: string;
}

interface EnhancedBorrowing {
  id: string;
  book_id: string;
  legacy_book_id?: string;
  student_id?: string;
  staff_id?: string;
  borrowed_date: string;
  due_date: string;
  status: string;
  created_at?: string;
  book_copies?: any;
  book: Book;
  books?: Book; // For compatibility with BorrowingManagement display pattern
  student: Student | null;
  staff: Staff | null;
  borrower_type: 'student' | 'staff' | 'unknown';
  borrower_name: string;
  borrower_id: string;
  book_title: string;
}

interface StudentLostBooksEntry {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
    class_grade: string;
  };
  books: any[];
  totalFine: number;
}

export const Reports = () => {
  const [selectedReportType, setSelectedReportType] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all_time');
  const [staffOverduePage, setStaffOverduePage] = useState(1);
  const [staffOverduePageSize] = useState(50);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [currentReportTitle, setCurrentReportTitle] = useState<string>('');
  
  const { toast } = useToast();
  const [initialLoad, setInitialLoad] = useState(true);

  // Date range options for professional reporting
  const dateRangeOptions = [
    { value: 'all_time', label: 'All Time', description: 'Complete historical data' },
    { value: 'current_year', label: 'Current Academic Year', description: 'This academic year' },
    { value: 'last_12_months', label: 'Last 12 Months', description: 'Rolling 12-month period' },
    { value: 'last_6_months', label: 'Last 6 Months', description: 'Rolling 6-month period' },
    { value: 'last_3_months', label: 'Last 3 Months', description: 'Rolling 3-month period' },
    { value: 'current_month', label: 'Current Month', description: 'This month only' },
    { value: 'last_month', label: 'Last Month', description: 'Previous month' },
    { value: 'current_term', label: 'Current Term', description: 'Current academic term' },
  ];



  // Helper function to get date range based on selection
  const getDateRange = (rangeType: string) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    switch (rangeType) {
      case 'current_year':
        return {
          start: new Date(currentYear, 0, 1), // January 1st
          end: new Date(currentYear, 11, 31), // December 31st
          label: `Academic Year ${currentYear}`
        };
      case 'last_12_months':
        return {
          start: new Date(now.getFullYear(), now.getMonth() - 12, now.getDate()),
          end: now,
          label: 'Last 12 Months'
        };
      case 'last_6_months':
        return {
          start: new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()),
          end: now,
          label: 'Last 6 Months'
        };
      case 'last_3_months':
        return {
          start: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
          end: now,
          label: 'Last 3 Months'
        };
      case 'current_month':
        return {
          start: new Date(currentYear, currentMonth, 1),
          end: new Date(currentYear, currentMonth + 1, 0),
          label: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        };
      case 'last_month':
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        return {
          start: new Date(lastMonthYear, lastMonth, 1),
          end: new Date(lastMonthYear, lastMonth + 1, 0),
          label: new Date(lastMonthYear, lastMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        };
      case 'current_term':
        // Assuming terms: Jan-Apr, May-Aug, Sep-Dec
        const termStart = Math.floor(currentMonth / 4) * 4;
        return {
          start: new Date(currentYear, termStart, 1),
          end: new Date(currentYear, termStart + 4, 0),
          label: `Term ${Math.floor(currentMonth / 4) + 1} ${currentYear}`
        };
      default: // 'all_time'
        return {
          start: new Date(2020, 0, 1), // Reasonable start date
          end: now,
          label: 'All Time'
        };
    }
  };

  // Get current date range info
  const currentDateRange = getDateRange(selectedDateRange);
  
  // Use offline hooks for local database - same as BorrowingManagement
  const { data: classes, isLoading: classesLoading } = useClassesOffline();
  
  // Use the same data source as BorrowingManagement for consistent data
  const { data: borrowingsData, isLoading: isLoadingBorrowings } = useBorrowingsOffline();
  
  // Enhanced students data with direct database query
  const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['enhanced-students-for-reports'],
    queryFn: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      console.log('� Fetching enhanced students data for reports...');
      return await invoke('get_students');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
  
  // Enhanced books data with direct database query
  const { data: booksData } = useQuery({
    queryKey: ['enhanced-books-for-reports'],
    queryFn: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      console.log('📚 Fetching enhanced books data for reports...');
      return await invoke('get_books');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Enhanced staff data with direct database query
  const { data: staffData } = useQuery({
    queryKey: ['enhanced-staff-for-reports'],
    queryFn: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      console.log('👨‍🏫 Fetching enhanced staff data for reports...');
      return await invoke('get_staff');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Report-specific queries using the new Tauri commands
  const { data: reportStudentOverdueBooks } = useQuery({
    queryKey: ['student-overdue-books'],
    queryFn: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('get_student_overdue_books');
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: reportStaffOverdueBooks } = useQuery({
    queryKey: ['staff-overdue-books'],
    queryFn: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('get_staff_overdue_books');
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: reportBorrowingStatistics } = useQuery({
    queryKey: ['borrowing-statistics'],
    queryFn: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('get_borrowing_statistics');
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: reportBooksByCategory } = useQuery({
    queryKey: ['books-by-category'],
    queryFn: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('get_books_by_category');
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: reportPopularBooks } = useQuery({
    queryKey: ['popular-books'],
    queryFn: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('get_popular_books', { limit: 20 });
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: reportClassBorrowing } = useQuery({
    queryKey: ['class-borrowing-report'],
    queryFn: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('get_class_borrowing_report');
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: reportFineReports } = useQuery({
    queryKey: ['fine-reports'],
    queryFn: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('get_fine_reports');
    },
    staleTime: 5 * 60 * 1000,
  });
  
  // Process the enhanced data with proper relationships
  const borrowings = useMemo(() => {
    const rawBorrowings = (borrowingsData || []) as any[]; // Type assertion for flexible access
    const allBooks = booksData || [];
    const allStudents = studentsData || [];
    const allStaff = staffData || [];
    
    console.log('📊 Processing borrowings data:', { 
      borrowingsCount: rawBorrowings.length, 
      booksCount: allBooks.length,
      studentsCount: allStudents.length,
      staffCount: allStaff.length,
      sample: rawBorrowings[0],
      sampleBookData: rawBorrowings[0]?.books || rawBorrowings[0]?.book || rawBorrowings[0]?.book_title,  // Check multiple patterns
      sampleStudentData: rawBorrowings[0]?.students || rawBorrowings[0]?.student || rawBorrowings[0]?.student_name,
      sampleLegacyId: rawBorrowings[0]?.legacy_book_id
    });
    
    // Create lookup maps for better performance
    const booksMap = new Map(allBooks.map((book: any) => [book.id, book as Book]));
    const studentsMap = new Map(allStudents.map((student: any) => [student.id, student as Student]));
    const staffMap = new Map(allStaff.map((staff: any) => [staff.id, staff as Staff]));
    
    // Enhance borrowings with relationship data
    const enhancedBorrowings: EnhancedBorrowing[] = rawBorrowings.map((borrowing: any) => {
      // Use embedded book data exactly like BorrowingManagement does
      const book = borrowing.books ||  // Primary: Use same property as BorrowingManagement
                   borrowing.book || 
                   booksMap.get(borrowing.legacy_book_id) || 
                   booksMap.get(borrowing.book_id) as Book | undefined;
      
      const student = borrowing.students ||  // Use same property as BorrowingManagement
                     borrowing.student || 
                     studentsMap.get(borrowing.student_id) as Student | undefined;
      
      const staff = borrowing.staff || 
                   staffMap.get(borrowing.staff_id) as Staff | undefined;
      
      // Determine borrower type and info
      let borrower_type: 'student' | 'staff' | 'unknown' = 'unknown';
      let borrower_name = 'Unknown';
      let borrower_id = 'unknown';
      
      if (student) {
        borrower_type = 'student';
        borrower_name = `${student.first_name} ${student.last_name}`;
        borrower_id = student.id;
      } else if (staff) {
        borrower_type = 'staff';
        borrower_name = `${staff.first_name} ${staff.last_name}`;
        borrower_id = staff.id;
      }
      
      return {
        ...borrowing,
        book: book || { id: borrowing.book_id, title: 'Unknown Book' },
        books: book || { id: borrowing.book_id, title: 'Unknown Book' }, // For compatibility with display components
        student: student || null,
        staff: staff || null,
        borrower_type,
        borrower_name,
        borrower_id,
        // Ensure book title is available for reports
        book_title: book?.title || 'Unknown Book'
      } as EnhancedBorrowing;
    });
    
    console.log('📊 Enhanced borrowings sample:', enhancedBorrowings[0]);
    return { data: enhancedBorrowings };
  }, [borrowingsData, booksData, studentsData, staffData]);
  
  const books = useMemo(() => {
    const data = booksData || [];
    console.log('📚 Processing books data:', { count: data.length });
    return data;
  }, [booksData]);
  
  // Get total book count from database
  const { data: totalBooksCount } = useQuery({
    queryKey: ['books-total-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
  const { data: fineCollection, isLoading: isLoadingFines } = useFineCollection();
  const { data: lostBooks } = useLostBooks();
  
  // Safely get group borrowings with error handling
  const { groupBorrowings } = useGroupBorrowings();
  const { data: offlineGroupBorrowings } = useGroupBorrowingsOffline();
  
  // Use offline data as fallback if online data is empty or failed
  const finalGroupBorrowings = React.useMemo(() => {
    // Ensure we always return an array
    const onlineData = Array.isArray(groupBorrowings) ? groupBorrowings : [];
    const offlineData = Array.isArray(offlineGroupBorrowings) ? offlineGroupBorrowings : [];
    
    if (onlineData.length > 0) {
      return onlineData;
    }
    return offlineData;
  }, [groupBorrowings, offlineGroupBorrowings]);

  // Enhanced debugging for group borrowings
  React.useEffect(() => {
    console.log('=== GROUP BORROWINGS DEBUG ===');
    console.log('Online group borrowings:', {
      defined: groupBorrowings !== undefined,
      isArray: Array.isArray(groupBorrowings),
      length: Array.isArray(groupBorrowings) ? groupBorrowings.length : 'N/A',
      data: groupBorrowings
    });
    console.log('Offline group borrowings:', {
      defined: offlineGroupBorrowings !== undefined,
      isArray: Array.isArray(offlineGroupBorrowings),
      length: Array.isArray(offlineGroupBorrowings) ? offlineGroupBorrowings.length : 'N/A',
      data: offlineGroupBorrowings
    });
    console.log('Final group borrowings:', {
      length: Array.isArray(finalGroupBorrowings) ? finalGroupBorrowings.length : 'N/A',
      data: finalGroupBorrowings
    });
    
    // Direct database check
    const checkDatabase = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const directResult = await invoke('get_group_borrowings');
        console.log('Direct database query result:', {
          length: Array.isArray(directResult) ? directResult.length : 'N/A',
          data: directResult
        });
      } catch (error) {
        console.error('Direct database query failed:', error);
      }
    };
    
    checkDatabase();
    console.log('===============================');
  }, [groupBorrowings, offlineGroupBorrowings, finalGroupBorrowings]);
  
  const students = React.useMemo(() => {
    const processedStudentsData = Array.isArray(studentsData) 
      ? studentsData 
      : [];
    
    console.log('Students Data Debug:', {
      studentsDataType: typeof studentsData,
      studentsDataKeys: studentsData ? Object.keys(studentsData) : [],
      studentsCount: processedStudentsData.length,
      sampleStudent: processedStudentsData[0]
    });
    
    return processedStudentsData;
  }, [studentsData]);
  
  // Show skeleton for a brief moment for perceived performance
  React.useEffect(() => {
    const timer = setTimeout(() => setInitialLoad(false), 300);
    return () => clearTimeout(timer);
  }, []);





  const ensureDataLoaded = async () => {
    console.log('🔄 Ensuring all data is loaded for report generation...');
    
    // Check if critical data is available
    const dataStatus = {
      borrowings: borrowings?.data?.length || 0,
      books: books?.length || 0,
      students: students?.length || 0,
      classes: classes?.length || 0
    };
    
    console.log('📊 Current data status:', dataStatus);
    
    // If we have minimal data, try to refresh
    if (dataStatus.borrowings === 0 || dataStatus.books === 0) {
      console.log('⚠️ Critical data missing, data should be loaded via hooks');
    }
    
    console.log('✅ Data loading check completed');
  };

  console.log('Classes data:', classes);
  console.log('Students data:', students);

  // Optimized classes calculation with student count mapping using class_grade
  const studentCountByClass = useMemo(() => {
    if (!students || students.length === 0) return new Map();
    
    const countMap = new Map();
    students.forEach(student => {
      // Match by class_grade field since class_id is not properly populated
      if (student.class_grade) {
        // Find matching class by class_name or name
        const matchingClass = classes?.find(cls => 
          (cls as any).class_name === student.class_grade || 
          (cls as any).name === student.class_grade
        );
        if (matchingClass) {
          countMap.set(matchingClass.id, (countMap.get(matchingClass.id) || 0) + 1);
        }
      }
    });
    return countMap;
  }, [students, classes]);

  const getAvailableClasses = useMemo(() => {
    if (!classes || classes.length === 0) return [];
    
    // Sort classes by form_level first, then by class_section
    const sortedClasses = [...classes].sort((a, b) => {
      const aFormLevel = (a as any).form_level || (a as any).grade_level || 1;
      const bFormLevel = (b as any).form_level || (b as any).grade_level || 1;
      if (aFormLevel !== bFormLevel) {
        return aFormLevel - bFormLevel;
      }
      // Handle null or undefined class_section values
      const aSection = (a as any).class_section || (a as any).section;
      const bSection = (b as any).class_section || (b as any).section;
      if (!aSection && !bSection) return 0;
      if (!aSection) return -1;
      if (!bSection) return 1;
      return aSection.localeCompare(bSection);
    });

    // Use pre-calculated student counts and filter out classes with 0 students
    return sortedClasses
      .map(cls => ({
        ...cls,
        studentCount: studentCountByClass.get(cls.id) || 0
      }))
      .filter(cls => cls.studentCount > 0);
  }, [classes, studentCountByClass]);

  // Add supplier data query at the top level with other hooks
  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    queryKey: ['books-by-supplier'],
    queryFn: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('get_books_by_supplier');
    },
    enabled: selectedReportType === 'book_suppliers'
  });

  // Add staff overdue books query
  const { data: staffOverdueResponse, isLoading: staffOverdueLoading } = useQuery({
    queryKey: ['staff-overdue-books', staffOverduePage, staffOverduePageSize, selectedDateRange],
    queryFn: async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      const dateRange = getDateRange(selectedDateRange);
      
      return await invoke('get_staff_overdue_books', {
        page: staffOverduePage,
        pageSize: staffOverduePageSize,
        startDate: selectedDateRange === 'all_time' ? null : dateRange.start.toISOString().split('T')[0],
        endDate: selectedDateRange === 'all_time' ? null : dateRange.end.toISOString().split('T')[0]
      });
    },
    enabled: selectedReportType === 'staff_overdue_books'
  });

  const availableClasses = getAvailableClasses;

  const reportTypes = [
    {
      id: 'borrowing_history',
      title: 'Borrowing History',
      description: 'Complete history of all book borrowings and returns with detailed tracking',
      icon: FileText,
      color: 'bg-blue-500',
    },
    {
      id: 'overdue_books',
      title: 'Overdue Books Report',
      description: 'Critical report of all books currently overdue for return',
      icon: Calendar,
      color: 'bg-red-500',
    },
    {
      id: 'popular_books',
      title: 'Popular Books Analytics',
      description: 'Data-driven analysis of most frequently borrowed books',
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      id: 'student_activity',
      title: 'Student Activity Report',
      description: 'Comprehensive student borrowing patterns and engagement metrics',
      icon: FileText,
      color: 'bg-purple-500',
    },
    {
      id: 'fine_collection',
      title: 'Fine Collection Report',
      description: 'Financial summary of fines collected from overdue books',
      icon: Currency,
      color: 'bg-amber-500',
    },
    {
      id: 'lost_books',
      title: 'Lost Books Report',
      description: 'Track books that have been reported as lost by students',
      icon: BookX,
      color: 'bg-rose-500',
    },
    {
      id: 'theft_reports',
      title: 'Theft Reports',
      description: 'Track and manage book theft incidents and investigations',
      icon: Shield,
      color: 'bg-red-600',
    },
    {
      id: 'library_summary',
      title: 'Library Summary',
      description: 'Overall library statistics and performance metrics',
      icon: TrendingUp,
      color: 'bg-orange-500',
    },
    {
      id: 'group_borrowings',
      title: 'Group Borrowings',
      description: 'Track and analyze group borrowing patterns and statistics',
      icon: UsersRound,
      color: 'bg-indigo-500',
    },
    {
      id: 'book_suppliers',
      title: 'Book Suppliers Report',
      description: 'Books organized by supplier type with copy counts',
      icon: Users,
      color: 'bg-teal-500',
    },
    {
      id: 'staff_overdue_books',
      title: 'Staff Overdue Books',
      description: 'Books overdue from staff borrowings with fine calculations',
      icon: Calendar,
      color: 'bg-red-400',
    },
    {
      id: 'staff_activity',
      title: 'Staff Activity',
      description: 'Track staff borrowing operations and activity patterns',
      icon: Users,
      color: 'bg-teal-500',
    },
    {
      id: 'staff_borrowing_trends',
      title: 'Staff Borrowing Trends',
      description: 'Analyze staff borrowing patterns over time',
      icon: TrendingUp,
      color: 'bg-cyan-500',
    },
    {
      id: 'staff_most_borrowed',
      title: 'Staff Most Borrowed Books',
      description: 'Books most frequently borrowed by staff members',
      icon: FileText,
      color: 'bg-emerald-500',
    },
    {
      id: 'staff_borrowing_history',
      title: 'Staff Borrowing History',
      description: 'Complete borrowing history with book copies for staff',
      icon: Calendar,
      color: 'bg-violet-500',
    },
  ];

  // Memoized filtered students for instant performance using class_grade matching
  const filteredStudents = useMemo(() => {
    if (!students || !students.length) return [];
    if (selectedClass === 'all') return students;
    
    // Find the selected class name
    const selectedClassObj = availableClasses.find(cls => cls.id === selectedClass);
    const selectedClassName = selectedClassObj ? 
      ((selectedClassObj as any).class_name || (selectedClassObj as any).name) : null;
    if (!selectedClassName) return [];
    
    // Filter by class_grade field since class_id is not properly populated
    return students.filter(student => student.class_grade === selectedClassName);
  }, [students, selectedClass, availableClasses]);

  // Memoized filtered borrowings for instant performance
  const filteredBorrowings = useMemo(() => {
    const borrowingsArray = borrowings?.data || [];
    if (!borrowingsArray.length) return [];
    if (selectedClass === 'all') return borrowingsArray;
    const classStudentIds = new Set(filteredStudents.map(s => s.id));
    return borrowingsArray.filter(borrowing => classStudentIds.has(borrowing.student_id));
  }, [borrowings?.data, selectedClass, filteredStudents]);

  // Use the dedicated report data for overdue books
  const overdueBooks = useMemo(() => {
    const reportData = reportStudentOverdueBooks?.data || [];
    return reportData.map(item => ({
      ...item,
      student_id: item.student?.id || 'unknown',
      book_title: item.book?.title || 'Unknown Book',
      student_name: `${item.student?.first_name || ''} ${item.student?.last_name || ''}`.trim() || 'Unknown Student',
      class_grade: item.student?.class_grade || 'Unknown Class',
      admission_number: item.student?.admission_number || 'N/A',
      legacy_book_id: item.book?.legacy_book_id
    }));
  }, [reportStudentOverdueBooks]);

  // Memoized popular books calculation
  const popularBooks = useMemo(() => {
    if (!books) return [];
    const bookBorrowCounts = filteredBorrowings.reduce((acc, borrowing: any) => {
      acc[(borrowing.legacy_book_id || borrowing.book_id)] = (acc[(borrowing.legacy_book_id || borrowing.book_id)] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return books
      .map(book => ({
        ...book,
        borrowCount: bookBorrowCounts[book.id] || 0
      }))
      .sort((a, b) => b.borrowCount - a.borrowCount)
      .slice(0, 10);
  }, [books, filteredBorrowings]);

  // Memoized student activity calculation
  const studentActivity = useMemo(() => {
    if (!filteredStudents.length) return [];
    
    // Create maps for efficient lookups
    const studentBorrowCounts = filteredBorrowings.reduce((acc, borrowing) => {
      if (borrowing.student_id) {
        acc[borrowing.student_id] = (acc[borrowing.student_id] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const studentActiveBorrowings = filteredBorrowings
      .filter(b => b.status === 'active')
      .reduce((acc, borrowing) => {
        if (borrowing.student_id) {
          acc[borrowing.student_id] = (acc[borrowing.student_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

    // Get all students with their activity data
    const activity = filteredStudents.map(student => ({
      ...student,
      borrowCount: studentBorrowCounts[student.id] || 0,
      activeBorrowings: studentActiveBorrowings[student.id] || 0,
      className: (() => {
        const classObj = availableClasses.find(c => c.id === student.class_id);
        return classObj ? ((classObj as any).class_name || (classObj as any).name) : 'Unknown Class';
      })()
    }));

    // Sort by most active students first
    return activity.sort((a, b) => b.borrowCount - a.borrowCount);
  }, [filteredStudents, filteredBorrowings, availableClasses]);

  // Memoized filtered group borrowings
  const filteredGroupBorrowings = useMemo(() => {
    console.log('=== FILTERING GROUP BORROWINGS ===');
    console.log('finalGroupBorrowings:', finalGroupBorrowings?.length || 0);
    console.log('selectedClass:', selectedClass);
    console.log('filteredStudents:', filteredStudents?.length || 0);
    
    if (!finalGroupBorrowings) {
      console.log('No finalGroupBorrowings, returning empty array');
      return [];
    }
    
    if (selectedClass === 'all') {
      console.log('Selected class is "all", returning all group borrowings:', finalGroupBorrowings.length);
      return finalGroupBorrowings;
    }

    const classStudentIds = new Set(filteredStudents.map(s => s.id));
    console.log('Class student IDs:', Array.from(classStudentIds));
    
    const filtered = finalGroupBorrowings.filter(borrowing => {
      // Handle student_ids that might be a string (JSON) or array
      let studentIds = borrowing.student_ids || [];
      
      // If student_ids is a string, try to parse it as JSON
      if (typeof studentIds === 'string') {
        try {
          studentIds = JSON.parse(studentIds);
        } catch (error) {
          console.warn(`Failed to parse student_ids for borrowing ${borrowing.id}:`, studentIds);
          studentIds = [];
        }
      }
      
      // Ensure it's an array
      if (!Array.isArray(studentIds)) {
        console.warn(`student_ids is not an array for borrowing ${borrowing.id}:`, studentIds);
        studentIds = [];
      }
      
      const hasMatch = studentIds.some(id => classStudentIds.has(id));
      console.log(`Borrowing ${borrowing.id}: student_ids=${JSON.stringify(studentIds)}, hasMatch=${hasMatch}`);
      return hasMatch;
    });
    
    console.log('Filtered group borrowings result:', filtered.length);
    console.log('=====================================');
    return filtered;
  }, [finalGroupBorrowings, selectedClass, filteredStudents]);

  // Enhanced staff activity calculation with trends and history
  const staffActivity = useMemo(() => {
    if (!filteredBorrowings || !Array.isArray(filteredBorrowings)) return [];
    
    const staffBorrowingData = filteredBorrowings.reduce((acc, borrowing) => {
      const isStaffBorrowing = borrowing.borrower_type === 'staff' || (borrowing.staff && borrowing.staff.id);
      
      if (isStaffBorrowing) {
        const staffInfo = borrowing.staff || {
          id: borrowing.borrower_id || 'unknown',
          first_name: borrowing.borrower_name?.split(' ')[0] || 'Unknown',
          last_name: borrowing.borrower_name?.split(' ').slice(1).join(' ') || 'Staff',
          department: 'General'
        };
        
        const staffId = staffInfo.id;
        if (!acc[staffId]) {
          acc[staffId] = {
            staff: staffInfo,
            totalBorrowings: 0,
            activeBorrowings: 0,
            returnedBorrowings: 0,
            overdueBorrowings: 0,
            borrowingHistory: [],
            bookCounts: {},
            monthlyTrend: {}
          };
        }
        
        acc[staffId].totalBorrowings++;
        acc[staffId].borrowingHistory.push({
          ...borrowing,
          book: books?.find(b => b.id === ((borrowing as any).legacy_book_id || borrowing.book_id)),
          book_copy: (borrowing as any).book_copies
        });
        
        // Count book borrowings
        const bookId = (borrowing as any).legacy_book_id || borrowing.book_id;
        acc[staffId].bookCounts[bookId] = (acc[staffId].bookCounts[bookId] || 0) + 1;
        
        // Monthly trend
        const borrowDate = new Date(borrowing.borrowed_date || (borrowing as any).created_at);
        const monthKey = `${borrowDate.getFullYear()}-${String(borrowDate.getMonth() + 1).padStart(2, '0')}`;
        acc[staffId].monthlyTrend[monthKey] = (acc[staffId].monthlyTrend[monthKey] || 0) + 1;
        
        if (borrowing.status === 'active') {
          acc[staffId].activeBorrowings++;
          const dueDate = new Date(borrowing.due_date);
          if (dueDate < new Date()) {
            acc[staffId].overdueBorrowings++;
          }
        } else if (borrowing.status === 'returned') {
          acc[staffId].returnedBorrowings++;
        }
      }
      return acc;
    }, {} as Record<string, any>);

    // Process most borrowed books for each staff
    Object.values(staffBorrowingData).forEach((staff: any) => {
      staff.mostBorrowedBooks = Object.entries(staff.bookCounts)
        .map(([bookId, count]) => ({
          book: books?.find(b => b.id === bookId),
          count
        }))
        .filter(item => item.book)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 5);
        
      // Convert monthly trend to array for easier display
      staff.trendData = Object.entries(staff.monthlyTrend)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));
    });

    return Object.values(staffBorrowingData).sort((a: any, b: any) => b.totalBorrowings - a.totalBorrowings);
  }, [filteredBorrowings, books]);

  // Staff borrowing trends calculation
  const staffBorrowingTrends = useMemo(() => {
    const borrowingsArray = borrowings?.data || [];
    if (!borrowingsArray.length) return [];
    
    const staffTrends = borrowingsArray.reduce((acc, borrowing) => {
      const isStaffBorrowing = borrowing.borrower_type === 'staff' || (borrowing.staff && borrowing.staff.id);
      
      if (isStaffBorrowing) {
        const staffInfo = borrowing.staff || {
          id: borrowing.borrower_id || 'unknown',
          first_name: borrowing.borrower_name?.split(' ')[0] || 'Unknown',
          last_name: borrowing.borrower_name?.split(' ').slice(1).join(' ') || 'Staff',
          department: 'General'
        };
        
        const staffId = staffInfo.id;
        if (!acc[staffId]) {
          acc[staffId] = {
            staff: staffInfo,
            monthlyTrend: {}
          };
        }
        
        const borrowDate = new Date(borrowing.borrowed_date || (borrowing as any).created_at);
        const monthKey = `${borrowDate.getFullYear()}-${String(borrowDate.getMonth() + 1).padStart(2, '0')}`;
        acc[staffId].monthlyTrend[monthKey] = (acc[staffId].monthlyTrend[monthKey] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, any>);

    return Object.values(staffTrends).map((staff: any) => ({
      ...staff,
      trendData: Object.entries(staff.monthlyTrend)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month))
    }));
  }, [borrowings?.data]);

  // Staff most borrowed books calculation
  const staffMostBorrowed = useMemo(() => {
    const borrowingsArray = borrowings?.data || [];
    if (!borrowingsArray.length) return [];
    
    const staffBookCounts = borrowingsArray.reduce((acc, borrowing) => {
      const isStaffBorrowing = borrowing.borrower_type === 'staff' || (borrowing.staff && borrowing.staff.id);
      
      if (isStaffBorrowing) {
        const staffInfo = borrowing.staff || {
          id: borrowing.borrower_id || 'unknown',
          first_name: borrowing.borrower_name?.split(' ')[0] || 'Unknown',
          last_name: borrowing.borrower_name?.split(' ').slice(1).join(' ') || 'Staff',
          department: 'General'
        };
        
        const staffId = staffInfo.id;
        if (!acc[staffId]) {
          acc[staffId] = {
            staff: staffInfo,
            bookCounts: {}
          };
        }
        
        const bookId = borrowing.book_id;
        acc[staffId].bookCounts[bookId] = (acc[staffId].bookCounts[bookId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, any>);

    return Object.values(staffBookCounts).map((staff: any) => ({
      ...staff,
      mostBorrowedBooks: Object.entries(staff.bookCounts)
        .map(([bookId, count]) => ({
          book: books?.find(b => b.id === bookId),
          count
        }))
        .filter(item => item.book)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10)
    }));
  }, [borrowings?.data, books]);

  // Staff borrowing history calculation
  const staffBorrowingHistory = useMemo(() => {
    const borrowingsArray = borrowings?.data || [];
    if (!borrowingsArray.length) return [];
    
    const staffHistory = borrowingsArray.reduce((acc, borrowing) => {
      const isStaffBorrowing = borrowing.borrower_type === 'staff' || (borrowing.staff && borrowing.staff.id);
      
      if (isStaffBorrowing) {
        const staffInfo = borrowing.staff || {
          id: borrowing.borrower_id || 'unknown',
          first_name: borrowing.borrower_name?.split(' ')[0] || 'Unknown',
          last_name: borrowing.borrower_name?.split(' ').slice(1).join(' ') || 'Staff',
          department: 'General'
        };
        
        const staffId = staffInfo.id;
        if (!acc[staffId]) {
          acc[staffId] = {
            staff: staffInfo,
            borrowingHistory: []
          };
        }
        
        // Use embedded book data from borrowing or find in books array
        const bookData = borrowing.book || books?.find(b => 
          b.id === borrowing.book_id || 
          b.id === (borrowing as any).legacy_book_id ||
          b.legacy_book_id === (borrowing as any).legacy_book_id
        );
        
        // Try multiple ways to get the legacy book ID
        let legacyBookId = (borrowing as any).legacy_book_id || 
                          (borrowing as any).book_copies?.legacy_book_id || 
                          bookData?.legacy_book_id ||
                          bookData?.id; // fallback to book ID if legacy not available
        
        acc[staffId].borrowingHistory.push({
          ...borrowing,
          book: bookData,
          books: bookData, // For compatibility with display
          book_copies: (borrowing as any).book_copies || {
            copy_number: 'N/A',
            legacy_book_id: legacyBookId
          },
          legacy_book_id: legacyBookId
        });
      }
      return acc;
    }, {} as Record<string, any>);

    return Object.values(staffHistory).map((staff: any) => ({
      ...staff,
      borrowingHistory: staff.borrowingHistory.sort((a: any, b: any) => 
        new Date(b.borrowed_date || (b as any).created_at).getTime() - new Date(a.borrowed_date || (a as any).created_at).getTime()
      )
    }));
  }, [borrowings?.data, books]);

  // Helper function to filter data by date range
  const filterByDateRange = (items: any[], dateField: string) => {
    if (selectedDateRange === 'all_time') return items;
    
    if (!items || items.length === 0) {
      console.warn('No items to filter');
      return items;
    }
    
    const currentRange = getDateRange(selectedDateRange);
    
    const filtered = items.filter(item => {
      // Handle different possible date field names
      let dateValue = item[dateField];
      
      // If the primary field doesn't exist, try alternative field names
      if (!dateValue) {
        const alternativeFields = {
          'borrowed_at': ['borrowed_date', 'created_at'],
          'borrowed_date': ['borrowed_at', 'created_at'],
          'created_at': ['borrowed_date', 'borrowed_at', 'updated_at'],
          'updated_at': ['created_at', 'borrowed_date']
        };
        
        const alternatives = alternativeFields[dateField as keyof typeof alternativeFields] || [];
        for (const altField of alternatives) {
          if (item[altField]) {
            dateValue = item[altField];
            break;
          }
        }
      }
      
      if (!dateValue) {
        console.warn(`No date field found for item:`, item);
        return false;
      }
      
      const itemDate = new Date(dateValue);
      if (isNaN(itemDate.getTime())) {
        console.warn(`Invalid date value: ${dateValue}`);
        return false;
      }
      
      return itemDate >= currentRange.start && itemDate <= currentRange.end;
    });
    
    console.log(`Filtered ${items.length} items to ${filtered.length} for date range ${currentRange.label}`);
    return filtered;
  };

  const generateReport = async (reportType: string, preview: boolean = false) => {
    // Ensure data is loaded before generating report
    await ensureDataLoaded();
    
    let reportData: any = {};
    let title = '';
    const selectedClassObj = availableClasses?.find(cls => cls.id === selectedClass);
    const selectedClassName = selectedClass === 'all' 
      ? 'All Classes' 
      : (selectedClassObj ? ((selectedClassObj as any).class_name || (selectedClassObj as any).name) : 'Unknown Class');

    // Get date range for filtering
    const dateRange = getDateRange(selectedDateRange);
    const startDate = dateRange.start;
    const endDate = dateRange.end;
    
    // Debug logging
    console.log('=== REPORT GENERATION DEBUG ===');
    console.log('Report Type:', reportType);
    console.log('Selected Date Range:', selectedDateRange);
    console.log('Date Range:', { start: startDate, end: endDate, label: dateRange.label });
    console.log('Filtered Borrowings Count:', filteredBorrowings?.length || 0);
    console.log('Sample Borrowing Data:', filteredBorrowings?.[0]);
    
    // Log available date fields in the data
    if (filteredBorrowings && filteredBorrowings.length > 0) {
      const sampleItem = filteredBorrowings[0];
      const dateFields = Object.keys(sampleItem).filter(key => 
        key.includes('date') || key.includes('at') || key.includes('created') || key.includes('updated')
      );
      console.log('Available date fields in borrowing data:', dateFields);
      console.log('Date field values:', dateFields.reduce((acc, field) => {
        acc[field] = sampleItem[field];
        return acc;
      }, {} as any));
    }
    console.log('================================');
    
    switch (reportType) {
      case 'borrowing_history':
        const dateFilteredBorrowings = filterByDateRange(filteredBorrowings, 'borrowed_date');
        
        // Ensure we have data to report
        if (dateFilteredBorrowings.length === 0 && filteredBorrowings.length > 0) {
          console.warn('Date filtering removed all borrowings, using unfiltered data');
        }

        // Calculate statistics from ALL filtered borrowings (not limited to 100)
        const totalBorrowings = dateFilteredBorrowings.length;
        const activeBorrowings = dateFilteredBorrowings.filter(b => b.status === 'active').length;
        const returnedBooks = dateFilteredBorrowings.filter(b => b.status === 'returned').length;
        const studentsInvolved = new Set(dateFilteredBorrowings.map(b => b.student_id).filter(id => id)).size;

        // For display purposes, limit to first 100 records but calculate stats from all
        const borrowingsForDisplay = dateFilteredBorrowings.slice(0, 100);

        // Enrich borrowing data with book and student information (only for display)
        const enrichedBorrowings = borrowingsForDisplay.map(borrowing => {
          const book = books?.find(b => b.id === ((borrowing as any).legacy_book_id || borrowing.book_id)) || borrowing.book;
          const student = filteredStudents.find(s => s.id === borrowing.student_id) || borrowing.student;
          
          return {
            ...borrowing,
            book: book,
            student: student,
            book_title: book?.title || borrowing.book_title || 'Unknown Book',
            legacy_book_id: borrowing.book_copies?.legacy_book_id || borrowing.legacy_book_id || book?.legacy_book_id || 'N/A'
          };
        });
        
        console.log('📊 Enriched borrowings for preview:', {
          totalInDatabase: dateFilteredBorrowings.length,
          displayingCount: enrichedBorrowings.length,
          sample: enrichedBorrowings[0],
          hasBook: !!enrichedBorrowings[0]?.book,
          hasStudent: !!enrichedBorrowings[0]?.student
        });
        
        console.log('📊 Calculated borrowing history stats:', {
          totalBorrowings,
          activeBorrowings,
          returnedBooks,
          studentsInvolved,
          totalDatasetSize: dateFilteredBorrowings.length,
          displaySize: enrichedBorrowings.length,
          note: 'Statistics calculated from full dataset, preview shows limited records'
        });
        
        reportData = {
          borrowings: enrichedBorrowings,
          books,
          students: filteredStudents,
          selectedClass: selectedClassName,
          dateRange: dateRange.label,
          reportPeriod: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
          // Add calculated statistics
          totalBorrowings,
          activeBorrowings,
          returnedBooks,
          studentsInvolved
        };
        title = `Borrowing History Report - ${selectedClassName} (${dateRange.label})`;
        break;
      
      case 'overdue_books':
        // Use the dedicated report data directly
        const reportOverdueData = reportStudentOverdueBooks?.data || [];
        
        reportData = {
          overdueBooks: reportOverdueData,
          selectedClass: selectedClassName,
          dateRange: dateRange.label,
          reportPeriod: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
        };
        title = `Overdue Books Report - ${selectedClassName} (${dateRange.label})`;
        break;
      
      case 'popular_books':
        // Filter popular books based on borrowings within date range
        const dateFilteredBorrowingsForPopular = filterByDateRange(filteredBorrowings, 'borrowed_date');
        const bookPopularity = dateFilteredBorrowingsForPopular.reduce((acc: any, borrowing: any) => {
          const bookId = borrowing.legacy_book_id || borrowing.book_id;
          acc[bookId] = (acc[bookId] || 0) + 1;
          return acc;
        }, {});
        
        const dateFilteredPopularBooks = Object.entries(bookPopularity)
          .map(([bookId, count]) => ({
            book: books?.find(b => b.id === bookId),
            borrowCount: count
          }))
          .filter(item => item.book)
          .sort((a: any, b: any) => b.borrowCount - a.borrowCount)
          .slice(0, 20);
          
        reportData = {
          popularBooks: dateFilteredPopularBooks,
          selectedClass: selectedClassName,
          dateRange: dateRange.label,
          reportPeriod: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
        };
        title = `Popular Books Report - ${selectedClassName} (${dateRange.label})`;
        break;
      
      case 'student_activity':
        // Filter student activity based on borrowings within date range
        const dateFilteredBorrowingsForActivity = filterByDateRange(filteredBorrowings, 'borrowed_date');
        console.log('Student Activity Debug:', {
          filteredStudentsCount: filteredStudents.length,
          sampleStudent: filteredStudents[0],
          dateFilteredBorrowingsCount: dateFilteredBorrowingsForActivity.length
        });
        
        const studentActivityFiltered = filteredStudents.map(student => {
          const studentBorrowings = dateFilteredBorrowingsForActivity.filter(b => b.student_id === student.id);
          return {
            first_name: student.first_name,
            last_name: student.last_name,
            admission_number: student.admission_number,
            class_grade: student.class_grade,
            status: student.status,
            totalBorrowings: studentBorrowings.length,
            activeBorrowings: studentBorrowings.filter(b => b.status === 'active').length,
            overdueBorrowings: studentBorrowings.filter(b => 
              b.status === 'active' && new Date(b.due_date) < new Date()
            ).length
          };
        }).filter(activity => activity.totalBorrowings > 0);
        
        console.log('Generated Student Activity:', studentActivityFiltered.slice(0, 3));
        
        reportData = {
          studentActivity: studentActivityFiltered,
          selectedClass: selectedClassName,
          dateRange: dateRange.label,
          reportPeriod: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
        };
        title = `Student Activity Report - ${selectedClassName} (${dateRange.label})`;
        break;
        
      case 'fine_collection':
        if (isLoadingFines) {
          toast({
            title: "Loading",
            description: "Fine data is still loading. Please try again in a moment.",
            variant: "default"
          });
          return;
        }
        
        // Filter fine collection by date range (using created_at or updated_at field)
        const dateFilteredFines = filterByDateRange(fineCollection || [], 'created_at');
        
        console.log('Fine Collection Debug:', {
          original: fineCollection?.length || 0,
          filtered: dateFilteredFines?.length || 0,
          dateRange: selectedDateRange,
          sampleFine: fineCollection?.[0]
        });
        const totalFines = dateFilteredFines.reduce((sum: number, item: any) => 
          sum + item.total_fine_amount, 0
        ).toFixed(2) || "0.00";
        
        reportData = {
          fineCollection: dateFilteredFines,
          selectedClass: selectedClassName,
          totalFines,
          reportDate: new Date().toISOString().split('T')[0],
          dateRange: dateRange.label,
          reportPeriod: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
        };
        title = `Fine Collection Report - ${selectedClassName} (${dateRange.label})`;
        break;
      
      case 'library_summary':
        const dateFilteredBorrowingsForSummary = filterByDateRange(filteredBorrowings, 'borrowed_date');
        const dateFilteredOverdueForSummary = filterByDateRange(overdueBooks, 'borrowed_date');
        
        // Recalculate popular books for the date range
        const summaryBookPopularity = dateFilteredBorrowingsForSummary.reduce((acc: any, borrowing: any) => {
          const bookId = borrowing.legacy_book_id || borrowing.book_id;
          acc[bookId] = (acc[bookId] || 0) + 1;
          return acc;
        }, {});
        
        const summaryPopularBooks = Object.entries(summaryBookPopularity)
          .map(([bookId, count]) => ({
            book: books?.find(b => b.id === bookId),
            borrowCount: count
          }))
          .filter(item => item.book)
          .sort((a: any, b: any) => b.borrowCount - a.borrowCount)
          .slice(0, 5);

        // Enrich recent borrowings with book and student information
        const enrichedRecentBorrowings = dateFilteredBorrowingsForSummary
          .slice(0, 10)
          .map(borrowing => ({
            ...borrowing,
            book: books?.find(b => b.id === ((borrowing as any).legacy_book_id || borrowing.book_id)),
            student: filteredStudents.find(s => s.id === borrowing.student_id)
          }));
        
        reportData = {
          totalBooks: totalBooksCount || books?.length || 0,
          totalStudents: filteredStudents.length,
          activeBorrowings: dateFilteredBorrowingsForSummary.filter(b => b.status === 'active').length,
          overdueBooks: dateFilteredOverdueForSummary.length,
          popularBooks: summaryPopularBooks,
          recentBorrowings: enrichedRecentBorrowings,
          selectedClass: selectedClassName,
          dateRange: dateRange.label,
          reportPeriod: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
          totalBorrowingsInPeriod: dateFilteredBorrowingsForSummary.length
        };
        title = `Library Summary Report - ${selectedClassName} (${dateRange.label})`;
        break;
      
      case 'group_borrowings':
        const safeFilteredGroupBorrowings = Array.isArray(filteredGroupBorrowings) ? filteredGroupBorrowings : [];
        const dateFilteredGroupBorrowings = filterByDateRange(safeFilteredGroupBorrowings, 'borrowed_date');
        
        const groupBorrowingsData = {
          groupBorrowings: dateFilteredGroupBorrowings.map(borrowing => ({
            ...borrowing,
            books: books?.find(b => b.id === ((borrowing as any).legacy_book_id || borrowing.book_id)),
            students: students?.filter(s => {
              const studentIds = Array.isArray(borrowing.student_ids) ? borrowing.student_ids : [];
              return studentIds.includes(s.id);
            })
          })),
          selectedClass: selectedClassName,
          dateRange: dateRange.label,
          reportPeriod: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
        };
        await generatePDFReport(groupBorrowingsData, `Group Borrowings Report - ${selectedClassName} (${dateRange.label})`, 'group_borrowings');
        return;
      
      case 'book_suppliers':
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const rawSuppliersData = await invoke('get_books_by_supplier');
          const suppliersData = Array.isArray(rawSuppliersData) ? rawSuppliersData : [];
          
          reportData = {
            suppliers: suppliersData,
            totalSuppliers: suppliersData.length,
            totalBooks: suppliersData.reduce((sum: number, s: any) => sum + (s.book_count || 0), 0),
            totalCopies: suppliersData.reduce((sum: number, s: any) => sum + (s.total_copies || 0), 0),
            dateRange: dateRange.label,
            reportDate: new Date().toLocaleDateString()
          };
          title = `Book Suppliers Report (${dateRange.label})`;
        } catch (error) {
          console.error('Failed to generate supplier report:', error);
          toast({
            title: "Error",
            description: "Failed to generate supplier report",
            variant: "destructive",
          });
          return;
        }
        break;
      
      case 'staff_overdue_books':
        const staffOverdueData = reportStaffOverdueBooks?.data || [];
        
        reportData = {
          overdueBooks: staffOverdueData,
          selectedClass: selectedClassName,
          dateRange: dateRange.label,
          reportPeriod: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
        };
        title = `Staff Overdue Books Report - ${selectedClassName} (${dateRange.label})`;
        break;
      
      case 'staff_activity':
        const dateFilteredBorrowingsForStaff = filterByDateRange(filteredBorrowings, 'borrowed_date');
        const staffActivityFiltered = (staffActivity as any[]).filter((activity: any) => {
          const staffBorrowings = dateFilteredBorrowingsForStaff.filter((b: any) => b.staff?.id === activity.staff?.id);
          return staffBorrowings.length > 0;
        }).map((activity: any) => {
          const staffBorrowings = dateFilteredBorrowingsForStaff.filter((b: any) => b.staff?.id === activity.staff?.id);
          return {
            ...activity,
            totalBorrowings: staffBorrowings.length,
            activeBorrowings: staffBorrowings.filter((b: any) => b.status === 'active').length,
            returnedBorrowings: staffBorrowings.filter((b: any) => b.status === 'returned').length,
            overdueBorrowings: staffBorrowings.filter((b: any) => 
              b.status === 'active' && new Date(b.due_date) < new Date()
            ).length
          };
        });
        
        reportData = {
          staffActivity: staffActivityFiltered,
          selectedClass: selectedClassName,
          dateRange: dateRange.label,
          reportPeriod: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
        };
        title = `Staff Activity Report - ${selectedClassName} (${dateRange.label})`;
        break;
      
      case 'staff_borrowing_trends':
        const allBorrowingsForTrends = filterByDateRange(borrowings?.data || [], 'borrowed_date');
        reportData = {
          staffTrends: staffBorrowingTrends,
          dateRange: dateRange.label,
          reportPeriod: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
        };
        title = `Staff Borrowing Trends Report (${dateRange.label})`;
        break;
      
      case 'staff_most_borrowed':
        console.log('Staff most borrowed debug:', {
          staffMostBorrowedCount: staffMostBorrowed.length,
          sampleStaff: staffMostBorrowed[0]
        });
        
        reportData = {
          staffMostBorrowed: staffMostBorrowed,
          dateRange: dateRange.label,
          reportPeriod: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
        };
        title = `Staff Most Borrowed Books Report (${dateRange.label})`;
        break;
      
      case 'staff_borrowing_history':
        console.log('Generating staff borrowing history report:', {
          staffHistoryCount: staffBorrowingHistory.length,
          sampleStaff: staffBorrowingHistory[0]
        });
        
        reportData = {
          staffHistory: staffBorrowingHistory,
          dateRange: dateRange.label,
          reportPeriod: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
        };
        title = `Staff Borrowing History Report (${dateRange.label})`;
        break;
      
      case 'lost_books':
        // For lost books and theft reports, we don't use the preview system
        // Instead, we set the selectedReportType to show the dedicated components
        setSelectedReportType(reportType);
        setShowPreview(false);
        return;
      
      case 'theft_reports':
        // For lost books and theft reports, we don't use the preview system
        // Instead, we set the selectedReportType to show the dedicated components
        setSelectedReportType(reportType);
        setShowPreview(false);
        return;
      
      default:
        return;
    }

    if (preview) {
      setPreviewData(reportData);
      setCurrentReportTitle(title);
      setSelectedReportType(reportType);
      setShowPreview(true);
    } else {
      await generatePDFReport(reportData, title, reportType);
    }
  };

  const handleGenerateWithPreview = async (reportType: string) => {
    await generateReport(reportType, true);
  };

  const handleGeneratePDF = async () => {
    let isGenerating = false;
    
    try {
      if (isGenerating) {
        console.log('PDF generation already in progress');
        return;
      }
      
      isGenerating = true;
      console.log('handleGeneratePDF called');
      
      if (!previewData) {
        toast({
          title: "Error",
          description: "No report data available. Please generate a report first.",
          variant: "destructive",
        });
        return;
      }
      
      if (!currentReportTitle) {
        toast({
          title: "Error", 
          description: "No report title available.",
          variant: "destructive",
        });
        return;
      }
      
      if (!selectedReportType) {
        toast({
          title: "Error",
          description: "No report type selected.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Generating PDF",
        description: "Please wait while we generate your PDF report...",
      });

      // Create a copy of data to avoid reference issues
      const reportData = JSON.parse(JSON.stringify(previewData));
      
      await generatePDFReport(reportData, currentReportTitle, selectedReportType);
      
      // Small delay to ensure PDF generation completes
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: "Success",
        description: "PDF report generated successfully!",
      });
      
    } catch (error) {
      console.error('Error in handleGeneratePDF:', error);
      toast({
        title: "PDF Generation Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred while generating the PDF.",
        variant: "destructive",
      });
    } finally {
      isGenerating = false;
    }
  };

  // Memoized report stats for instant performance
  const stats = useMemo(() => {
    const totalBorrowings = filteredBorrowings?.length || 0;
    const activeBorrowings = filteredBorrowings?.filter(b => b.status === 'active').length || 0;
    const overdueCount = reportStudentOverdueBooks?.data?.length || 0;
    const totalBooks = totalBooksCount || books?.length || 0;
    const totalStudentsInClass = filteredStudents.length;
    const totalStudents = studentsData?.length || 0;

    return { totalBorrowings, activeBorrowings, overdueCount, totalBooks, totalStudentsInClass, totalStudents };
  }, [filteredBorrowings, reportStudentOverdueBooks, books, filteredStudents, studentsData]);

  // Render the selected report type with lazy loading
  const renderSelectedReport = () => {
    if (selectedReportType === 'lost_books') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="default" 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setSelectedReportType('');
                setShowPreview(false);
              }}
            >
              ← Back to Reports
            </Button>
          </div>
          <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
            <LostBooksReport onGeneratePDF={generateLostBooksReport} />
          </Suspense>
        </div>
      );
    }
    if (selectedReportType === 'theft_reports') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="default" 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setSelectedReportType('');
                setShowPreview(false);
              }}
            >
              ← Back to Reports
            </Button>
          </div>
          <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
            <TheftReportsView onGeneratePDF={() => generateTheftReport()} />
          </Suspense>
        </div>
      );
    }
    if (selectedReportType === 'group_borrowings') {
      return (
        <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
          <GroupBorrowingReport selectedClass={selectedClass} />
        </Suspense>
      );
    }
    
    if (selectedReportType === 'staff_overdue_books') {
      if (staffOverdueLoading) {
        return <div className="p-8 text-center">Loading staff overdue books...</div>;
      }

      const staffOverdueBooks = staffOverdueResponse?.data || [];
      const pagination = staffOverdueResponse?.pagination || {};

      return (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-6 border border-red-200">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Staff Overdue Books Report</h3>
                <p className="text-red-700 mt-1">Critical attention required for overdue items</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Report Period</div>
                <div className="font-semibold text-gray-900">{currentDateRange.label}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-red-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Total Overdue</p>
                  <p className="text-3xl font-bold text-red-700">{pagination.total_count || 0}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-orange-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Staff Affected</p>
                  <p className="text-3xl font-bold text-orange-700">{new Set(staffOverdueBooks.map((b: any) => b.staff?.staff_id)).size}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <Users className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-yellow-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">Avg Days Overdue</p>
                  <p className="text-3xl font-bold text-yellow-700">
                    {Math.round((staffOverdueBooks.reduce((sum: number, b: any) => sum + (b.days_overdue || 0), 0) || 0) / (staffOverdueBooks.length || 1))}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Calendar className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-purple-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Current Page</p>
                  <p className="text-3xl font-bold text-purple-700">{pagination.page || 1}</p>
                  <p className="text-xs text-purple-500">of {pagination.total_pages || 1}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900">Overdue Items Details</h4>
              <p className="text-sm text-gray-600 mt-1">
                Showing {((pagination.page - 1) * pagination.page_size) + 1} to {Math.min(pagination.page * pagination.page_size, pagination.total_count)} of {pagination.total_count} records
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TSC Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Legacy ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Overdue</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {staffOverdueBooks.map((borrowing: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {borrowing.staff?.first_name?.charAt(0)}{borrowing.staff?.last_name?.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {borrowing.staff?.first_name} {borrowing.staff?.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {borrowing.staff?.department || 'General'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-900">
                          {borrowing.staff?.staff_id || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                          {borrowing.book?.title || 'Unknown Book'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {borrowing.book?.author || 'Unknown Author'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-blue-600">
                          {borrowing.book?.legacy_book_id || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(borrowing.due_date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          borrowing.days_overdue > 90 ? 'bg-red-100 text-red-800' :
                          borrowing.days_overdue > 30 ? 'bg-orange-100 text-orange-800' :
                          borrowing.days_overdue > 14 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {Math.floor(borrowing.days_overdue)} days
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Page {pagination.page || 1} of {pagination.total_pages || 1} • {pagination.total_count || 0} total records
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStaffOverduePage(prev => Math.max(1, prev - 1))}
                    disabled={!pagination.has_prev}
                    className="text-sm"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStaffOverduePage(prev => prev + 1)}
                    disabled={!pagination.has_next}
                    className="text-sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    if (selectedReportType === 'book_suppliers') {
      if (suppliersLoading) {
        return <div className="p-8 text-center">Loading supplier report...</div>;
      }

      return (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Book Suppliers Report</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {suppliersData?.length || 0}
                </div>
                <div className="text-sm text-blue-600">Total Suppliers</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {Array.isArray(suppliersData) ? suppliersData.reduce((sum: number, s: any) => sum + (s.book_count || 0), 0) : 0}
                </div>
                <div className="text-sm text-green-600">Total Books</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {Array.isArray(suppliersData) ? suppliersData.reduce((sum: number, s: any) => sum + (s.total_copies || 0), 0) : 0}
                </div>
                <div className="text-sm text-purple-600">Total Copies</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Books</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Copies</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Array.isArray(suppliersData) ? suppliersData.map((supplier: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          supplier.supplier_type === 'government' ? 'bg-blue-100 text-blue-800' :
                          supplier.supplier_type === 'bookshop' ? 'bg-green-100 text-green-800' :
                          supplier.supplier_type === 'donors' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {supplier.supplier_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {supplier.supplier_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {supplier.book_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {supplier.total_copies}
                      </td>
                    </tr>
                  )) : []}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }
    
    if (selectedReportType === 'staff_activity') {
      return (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Staff Activity Report</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Borrowings</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Returned</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overdue</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(staffActivity as any[]).map((activity: any, index: number) => (
                    <tr key={activity.staff?.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {activity.staff?.first_name} {activity.staff?.last_name}
                          </div>
                          <div className="text-sm text-gray-500">ID: {activity.staff?.staff_id}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {activity.staff?.department || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {activity.totalBorrowings}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                        {activity.activeBorrowings}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                        {activity.returnedBorrowings}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {activity.overdueBorrowings}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(staffActivity as any[]).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No staff activity found for the selected criteria.
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    if (selectedReportType === 'staff_borrowing_trends') {
      return (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Staff Borrowing Trends</h3>
            <div className="space-y-6">
              {staffBorrowingTrends.map((staff) => (
                <div key={staff.staff.id} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">
                    {staff.staff.first_name} {staff.staff.last_name} - {staff.staff.department}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {staff.trendData.map((trend) => (
                      <div key={trend.month} className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-xs text-gray-600">{trend.month}</div>
                        <div className="text-lg font-semibold text-blue-600">{trend.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    if (selectedReportType === 'staff_most_borrowed') {
      return (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Staff Most Borrowed Books</h3>
            <div className="space-y-6">
              {staffMostBorrowed.map((staff) => (
                <div key={staff.staff.id} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">
                    {staff.staff.first_name} {staff.staff.last_name} - {staff.staff.department}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Book</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Author</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Times Borrowed</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {staff.mostBorrowedBooks.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{item.book?.title}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">{item.book?.author}</td>
                            <td className="px-4 py-2 text-sm font-semibold text-blue-600">{item.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    if (selectedReportType === 'staff_borrowing_history') {
      return (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Staff Borrowing History</h3>
            <div className="space-y-6">
              {staffBorrowingHistory.map((staff) => (
                <div key={staff.staff.id} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">
                    {staff.staff.first_name} {staff.staff.last_name} - {staff.staff.department}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Book</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Copy Info</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Borrowed Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {staff.borrowingHistory.map((borrowing, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2">
                              <div className="text-sm font-medium text-gray-900">{borrowing.books?.title}</div>
                              <div className="text-xs text-gray-500">Code: {borrowing.books?.book_code}</div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="text-sm text-gray-900">Copy #{borrowing.book_copies?.copy_number || 'N/A'}</div>
                              <div className="text-xs text-gray-500">ID: {borrowing.legacy_book_id || borrowing.book_copies?.legacy_book_id || borrowing.book?.legacy_book_id || 'N/A'}</div>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {new Date(borrowing.borrowed_date || borrowing.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {new Date(borrowing.due_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                borrowing.status === 'active' ? 'bg-yellow-100 text-yellow-800' :
                                borrowing.status === 'returned' ? 'bg-green-100 text-green-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {borrowing.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Enhanced function to generate lost books PDF report with better data handling
  const generateLostBooksReport = async () => {
    // Use the lostBooks data from the hook
    const lostBooksData = lostBooks || [];
    
    console.log('Generating lost books PDF report...');
    console.log('Lost books data:', lostBooksData);
    
    if (!lostBooksData || lostBooksData.length === 0) {
      toast({
        title: "No Data",
        description: "There are no lost books to include in the report.",
        variant: "default"
      });
      return;
    }

    // Get date range for filtering
    const dateRange = getDateRange(selectedDateRange);
    const startDate = dateRange.start;
    const endDate = dateRange.end;

    // Filter by class and date range
    let filteredLostBooks = selectedClass === 'all' 
      ? lostBooksData 
      : lostBooksData.filter(book => {
          return book.students?.class_id === selectedClass;
        });

    // Apply date range filtering if not "all_time"
    if (selectedDateRange !== 'all_time') {
      filteredLostBooks = filteredLostBooks.filter(book => {
        const lostDate = new Date(book.created_at || book.updated_at);
        return lostDate >= startDate && lostDate <= endDate;
      });
    }

    console.log('Filtered lost books:', filteredLostBooks);

    // Group books by student for the student view
    const studentLostBooksMap = filteredLostBooks.reduce((acc: Record<string, StudentLostBooksEntry>, book) => {
      const studentId = book.students?.id;
      if (!studentId || !book.students) return acc;
      
      if (!acc[studentId]) {
        acc[studentId] = {
          student: {
            id: book.students.id,
            first_name: book.students.first_name,
            last_name: book.students.last_name,
            admission_number: book.students.admission_number,
            class_grade: book.students.class_grade
          },
          books: [],
          totalFine: 0
        };
      }
      
      acc[studentId].books.push(book);
      acc[studentId].totalFine += book.fine_amount || 0;
      
      return acc;
    }, {});

    // Convert to array and sort by student name
    const sortedStudentLostBooks: StudentLostBooksEntry[] = (Object.values(studentLostBooksMap) as StudentLostBooksEntry[]).sort((a, b) => 
      `${a.student.last_name} ${a.student.first_name}`.localeCompare(
        `${b.student.last_name} ${b.student.first_name}`
      )
    );

    // Calculate total replacement cost
    const totalReplacementCost = filteredLostBooks.reduce((sum, book) => {
      const fine = book.fine_amount || 0;
      return sum + fine;
    }, 0);

    const selectedClassObj2 = availableClasses?.find(cls => cls.id === selectedClass);
    const selectedClassName = selectedClass === 'all' 
      ? 'All Classes' 
      : (selectedClassObj2 ? ((selectedClassObj2 as any).class_name || (selectedClassObj2 as any).name) : 'Unknown Class');

    const reportData = {
      lostBooks: filteredLostBooks,
      studentLostBooks: sortedStudentLostBooks,
      totalReplacementCost,
      selectedClass: selectedClassName,
      dateRange: dateRange.label,
      reportPeriod: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
    };

    console.log('Report data being sent to PDF generator:', reportData);
    await generatePDFReport(reportData, `Lost Books Report - ${selectedClassName} (${dateRange.label})`, 'lost_books');
  };

  const generateTheftReport = async () => {
    try {
      // Get date range for filtering
      const dateRange = getDateRange(selectedDateRange);
      const startDate = dateRange.start;
      const endDate = dateRange.end;

      // Build query with date filtering if not "all_time"
      let query = supabase
        .from('theft_reports')
        .select(`
          *,
          students!theft_reports_student_id_fkey (
            id,
            first_name,
            last_name,
            admission_number,
            class_grade,
            classes (class_name)
          ),
          books (
            id,
            title,
            author,
            book_code
          ),
          borrowings (
            id,
            students (
              id,
              first_name,
              last_name,
              admission_number,
              class_grade
            )
          )
        `);

      // Apply date range filtering if not "all_time"
      if (selectedDateRange !== 'all_time') {
        query = query
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());
      }

      const { data: theftReports, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Fetch associated theft fines
      const reportsWithFines = await Promise.all(
        (theftReports || []).map(async (report) => {
          const { data: fines } = await supabase
            .from('fines')
            .select('id, amount, fine_type, description, status')
            .eq('student_id', report.borrowings?.students?.id || '')
            .eq('fine_type', 'theft');

          return {
            ...report,
            theft_fines: fines || []
          };
        })
      );

      // Calculate statistics
      const statusStats = {
        total: reportsWithFines.length,
        reported: reportsWithFines.filter(r => r.status === 'reported').length,
        investigating: reportsWithFines.filter(r => r.status === 'investigating').length,
        resolved: reportsWithFines.filter(r => r.status === 'resolved').length,
        closed: reportsWithFines.filter(r => r.status === 'closed').length,
        totalFines: reportsWithFines.reduce((sum, report) => 
          sum + (report.theft_fines?.reduce((fineSum, fine) => fineSum + fine.amount, 0) || 0), 0
        ),
      };

      const reportData = {
        theftReports: reportsWithFines,
        statusStats,
        dateRange: dateRange.label,
        reportPeriod: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
      };

      await generatePDFReport(reportData, `Official Theft Investigation Report (${dateRange.label})`, 'theft_reports');
      
      toast({
        title: 'Report Generated',
        description: 'Theft investigation report has been generated successfully',
      });
    } catch (error) {
      console.error('Error generating theft report:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate theft report',
        variant: 'destructive',
      });
    }
  };

  // Enhanced loading state with better user feedback
  if (initialLoad || classesLoading || isLoadingStudents) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center animate-pulse">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Loading Professional Reports...</h1>
          </div>
          <p className="text-blue-700">Preparing advanced analytics and report generation tools</p>
        </div>
        <ReportsSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Tamnet Watermark */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-5">
        <img 
          src="/Tamnet Logo.png" 
          alt="Tamnet Systems" 
          className="w-96 h-96 object-contain transform rotate-12"
        />
      </div>
      
      {/* Content with higher z-index */}
      <div className="relative z-10">
      {/* Professional Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
                <p className="text-sm text-gray-600">Generate comprehensive library reports</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-green-600 font-medium">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              System Ready
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Filter */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-blue-600" />
              Class Selection
            </CardTitle>
            <p className="text-sm text-gray-600">Filter reports by specific class</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex-1">
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">All Classes</span>
                        <span className="text-gray-500">({students?.length || 0} students)</span>
                      </div>
                    </SelectItem>
                    {availableClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="font-medium">{(cls as any).name || (cls as any).class_name}</span>
                          <span className="text-gray-500">({cls.studentCount} students)</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-gray-600 bg-white px-3 py-2 rounded-md border">
                {selectedClass === 'all' 
                  ? `📊 Viewing data for all ${stats.totalStudentsInClass} students`
                  : `📊 Viewing data for ${stats.totalStudentsInClass} students in ${(() => {
                      const classObj = availableClasses?.find(cls => cls.id === selectedClass);
                      return classObj ? ((classObj as any).name || (classObj as any).class_name) : 'Unknown Class';
                    })()}`
                }
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date Range Filter */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
              Report Period
            </CardTitle>
            <p className="text-sm text-gray-600">Select date range for analysis</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex-1">
                <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select date range" />
                  </SelectTrigger>
                  <SelectContent>
                    {dateRangeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col items-start">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-purple-500" />
                            <span className="font-medium">{option.label}</span>
                          </div>
                          <span className="text-xs text-gray-500 ml-6">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-gray-600 bg-white px-3 py-2 rounded-md border">
                📅 Report period: <span className="font-medium">{currentDateRange.label}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Show Preview, Report Generator, or Special Reports */}
      {showPreview && previewData ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="default" 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setShowPreview(false);
                setPreviewData(null);
                setSelectedReportType('');
              }}
            >
              ← Back to Other Reports
            </Button>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline"
                onClick={() => generateReport(selectedReportType, true)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Refresh Preview
              </Button>
            </div>
          </div>
          <ReportPreview
            reportType={selectedReportType}
            data={previewData}
            title={currentReportTitle}
            onGeneratePDF={handleGeneratePDF}
            dateRange={currentDateRange}
            selectedClass={selectedClass === 'all' ? 'All Classes' : (availableClasses?.find(cls => cls.id === selectedClass)?.name || 'Selected Class')}
          />
        </div>
      ) : selectedReportType && ['lost_books', 'theft_reports'].includes(selectedReportType) ? (
        // Show special reports (Lost Books and Theft Reports)
        renderSelectedReport()
      ) : (
        <ReportGenerator
          onGenerateReport={handleGenerateWithPreview}
          selectedClass={selectedClass}
          selectedDateRange={selectedDateRange}
          availableClasses={availableClasses}
          stats={stats}
        />
      )}

      {/* Legacy Report Content for Special Cases - Remove this since it's now handled above */}
      {/* {renderSelectedReport()} */}



      {/* Legacy Report Generation - Hidden by default, shown only for special cases */}
      {!showPreview && selectedReportType && ['lost_books', 'theft_reports'].includes(selectedReportType) && (
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-green-600" />
              Legacy Report Generator
              <span className="text-sm font-normal text-green-700 bg-green-100 px-2 py-1 rounded-full">
                Special Reports
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-full">
                  <FileText className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <div className="font-medium text-amber-900">
                    {reportTypes.find(t => t.id === selectedReportType)?.title}
                  </div>
                  <div className="text-sm text-amber-700 mt-1">
                    {reportTypes.find(t => t.id === selectedReportType)?.description}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {availableClasses.length === 0 && (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600 mb-4">
              No classes with assigned students found.
            </p>
            <div className="text-sm text-gray-500">
              Ensure students are properly assigned to classes to generate reports.
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
};
