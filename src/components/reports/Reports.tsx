import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Calendar, TrendingUp, Filter, Users, Currency, BookX, Shield, UsersRound } from 'lucide-react';
import { useBorrowings, useFineCollection } from '@/hooks/useBorrowings';
import { useLostBooks } from '@/hooks/useLostBooks';
import { useBooks } from '@/hooks/useBooks';
import { useStudents } from '@/hooks/useStudents';
import { useOptimizedStudents } from '@/hooks/useOptimizedStudents';
import { useClasses } from '@/hooks/useClasses';
import { generatePDFReport } from '@/utils/reportGenerator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LostBooksReport } from './LostBooksReport';
import { TheftReportsView } from './TheftReportsView';
import { GroupBorrowingReport } from './GroupBorrowingReport';
import { useGroupBorrowings } from '@/hooks/useGroupBorrowings';

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
  
  const { data: borrowings } = useBorrowings();
  const { data: books } = useBooks();
  // Use useStudents with fetchAll: true to get all students
  // Fetch all students with retry logic
  const { data: studentsResponse, isLoading: isLoadingStudents } = useStudents({ 
    fetchAll: true,
    pageSize: 1000 // Fetch all students at once
  });
  
  // Extract students array safely with type assertion
  const students = React.useMemo(() => {
    const studentsData = Array.isArray(studentsResponse?.students) 
      ? studentsResponse.students 
      : [];
    
    console.log('Students loaded:', studentsData.length);
    if (studentsData.length === 0) {
      console.warn('No students data available. Check if the students table has data.');
    } else {
      console.log('Sample student data:', studentsData[0]);
    }
    
    return studentsData;
  }, [studentsResponse]);
  const { data: classes, isLoading: classesLoading } = useClasses();
  const { data: fineCollection, isLoading: isLoadingFines } = useFineCollection(selectedClass);
  const { toast } = useToast();
  const { data: lostBooks } = useLostBooks();
  const { groupBorrowings } = useGroupBorrowings();

  console.log('Classes data:', classes);
  console.log('Students data:', students);

  // Get all classes with student counts
  const getAvailableClasses = () => {
    if (!classes || classes.length === 0) return [];
    
    // Sort classes by form_level first, then by class_section
    const sortedClasses = [...classes].sort((a, b) => {
      if (a.form_level !== b.form_level) {
        return a.form_level - b.form_level;
      }
      // Handle null or undefined class_section values
      if (!a.class_section && !b.class_section) return 0;
      if (!a.class_section) return -1;
      if (!b.class_section) return 1;
      return a.class_section.localeCompare(b.class_section);
    });

    // Log class-student relationships for debugging
    const classesWithStudents = sortedClasses.map(cls => {
      const classStudents = students.filter(s => s.class_id === cls.id);
      console.log(`Class ${cls.class_name} (${cls.id}) has ${classStudents.length} students:`, classStudents);
      
      return {
        ...cls,
        studentCount: classStudents.length,
        students: classStudents // Include students array for reference
      };
    });

    return classesWithStudents;
  };

  const availableClasses = getAvailableClasses();

  const reportTypes = [
    {
      id: 'borrowing_history',
      title: 'Borrowing History',
      description: 'Complete history of all book borrowings and returns',
      icon: FileText,
      color: 'bg-blue-500',
    },
    {
      id: 'overdue_books',
      title: 'Overdue Books Report',
      description: 'List of all books currently overdue for return',
      icon: Calendar,
      color: 'bg-red-500',
    },
    {
      id: 'popular_books',
      title: 'Popular Books',
      description: 'Most frequently borrowed books in the library',
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      id: 'student_activity',
      title: 'Student Activity',
      description: 'Student borrowing patterns and statistics',
      icon: FileText,
      color: 'bg-purple-500',
    },
    {
      id: 'fine_collection',
      title: 'Fine Collection Report',
      description: 'Summary of fines collected from students for overdue books',
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
  ];

  // Filter students and borrowings by selected class
  const getFilteredStudents = () => {
    console.log('Filtering students. Selected class:', selectedClass);
    if (!students || !students.length) {
      console.log('No students data available');
      return [];
    }
    
    if (selectedClass === 'all') {
      console.log('Returning all students (no class filter)');
      return students;
    }

    // Log class-student relationships for debugging
    const classStudents = students.filter(student => student.class_id === selectedClass);
    console.log(`Found ${classStudents.length} students in class ${selectedClass}:`, classStudents);
    
    return classStudents;
  };

  const getFilteredBorrowings = () => {
    const borrowingsArray = borrowings?.data || [];
    if (!borrowingsArray.length) return [];
    if (selectedClass === 'all') return borrowingsArray;
    const classStudents = getFilteredStudents();
    const classStudentIds = new Set(classStudents.map(s => s.id));
    return borrowingsArray.filter(borrowing => classStudentIds.has(borrowing.student_id));
  };

  const getOverdueBooks = () => {
    const filteredBorrowings = getFilteredBorrowings();
    return filteredBorrowings.filter(borrowing => {
      if (borrowing.status !== 'active') return false;
      const dueDate = new Date(borrowing.due_date);
      return dueDate < new Date();
    });
  };

  const getPopularBooks = () => {
    if (!books) return [];
    const filteredBorrowings = getFilteredBorrowings();
    const bookBorrowCounts = filteredBorrowings.reduce((acc, borrowing) => {
      acc[borrowing.book_id] = (acc[borrowing.book_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return books
      .map(book => ({
        ...book,
        borrowCount: bookBorrowCounts[book.id] || 0
      }))
      .sort((a, b) => b.borrowCount - a.borrowCount)
      .slice(0, 10);
  };

  const getStudentActivity = () => {
    console.log('Getting student activity...');
    const filteredStudents = getFilteredStudents();
    const filteredBorrowings = getFilteredBorrowings();
    
    console.log('Filtered students:', filteredStudents);
    console.log('Filtered borrowings:', filteredBorrowings);
    
    if (!filteredStudents.length) {
      console.log('No students found for the selected class');
      return [];
    }
    
    // Create a map of student borrow counts
    const studentBorrowCounts = filteredBorrowings.reduce((acc, borrowing) => {
      if (borrowing.student_id) {
        acc[borrowing.student_id] = (acc[borrowing.student_id] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    console.log('Student borrow counts:', studentBorrowCounts);

    // Get all students with their activity data
    const studentActivity = filteredStudents.map(student => {
      const borrowCount = studentBorrowCounts[student.id] || 0;
      const activeBorrowings = filteredBorrowings.filter(b => 
        b.student_id === student.id && b.status === 'active'
      ).length;
      
      console.log(`Student ${student.first_name} ${student.last_name} (${student.id}):`, {
        borrowCount,
        activeBorrowings,
        classId: student.class_id
      });
      
      return {
        ...student,
        borrowCount,
        activeBorrowings,
        className: availableClasses.find(c => c.id === student.class_id)?.class_name || 'Unknown Class'
      };
    });

    // Sort by most active students first
    return studentActivity.sort((a, b) => b.borrowCount - a.borrowCount);
  };

  const getFilteredGroupBorrowings = () => {
    if (!groupBorrowings) return [];
    if (selectedClass === 'all') return groupBorrowings;

    return groupBorrowings.filter(borrowing => {
      const studentIds = borrowing.student_ids || [];
      return studentIds.some(id => {
        const student = students?.find(s => s.id === id);
        return student?.class_id === selectedClass;
      });
    });
  };

  const filteredGroupBorrowings = getFilteredGroupBorrowings();

  const generateReport = async (reportType: string) => {
    let reportData: any = {};
    let title = '';
    const selectedClassName = selectedClass === 'all' 
      ? 'All Classes' 
      : availableClasses?.find(cls => cls.id === selectedClass)?.class_name || 'Unknown Class';

    switch (reportType) {
      case 'borrowing_history':
        reportData = {
          borrowings: getFilteredBorrowings().slice(0, 100),
          books,
          students: getFilteredStudents(),
          selectedClass: selectedClassName
        };
        title = `Borrowing History Report - ${selectedClassName}`;
        break;
      
      case 'overdue_books':
        reportData = {
          overdueBooks: getOverdueBooks(),
          books,
          students: getFilteredStudents(),
          selectedClass: selectedClassName
        };
        title = `Overdue Books Report - ${selectedClassName}`;
        break;
      
      case 'popular_books':
        reportData = {
          popularBooks: getPopularBooks(),
          selectedClass: selectedClassName
        };
        title = `Popular Books Report - ${selectedClassName}`;
        break;
      
      case 'student_activity':
        reportData = {
          studentActivity: getStudentActivity(),
          selectedClass: selectedClassName
        };
        title = `Student Activity Report - ${selectedClassName}`;
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
        
        const totalFines = fineCollection?.reduce((sum: number, item: any) => 
          sum + item.total_fine_amount, 0
        ).toFixed(2) || "0.00";
        
        reportData = {
          fineCollection: fineCollection || [],
          selectedClass: selectedClassName,
          totalFines,
          reportDate: new Date().toISOString().split('T')[0]
        };
        title = `Fine Collection Report - ${selectedClassName}`;
        break;
      
      case 'library_summary':
        const filteredStudents = getFilteredStudents();
        const filteredBorrowings = getFilteredBorrowings();
        reportData = {
          totalBooks: books?.length || 0,
          totalStudents: filteredStudents.length,
          activeBorrowings: filteredBorrowings.filter(b => b.status === 'active').length,
          overdueBooks: getOverdueBooks().length,
          popularBooks: getPopularBooks().slice(0, 5),
          recentBorrowings: filteredBorrowings.slice(0, 10),
          selectedClass: selectedClassName
        };
        title = `Library Summary Report - ${selectedClassName}`;
        break;
      
      case 'group_borrowings':
        const groupBorrowingsData = {
          groupBorrowings: filteredGroupBorrowings.map(borrowing => ({
            ...borrowing,
            books: books?.find(b => b.id === borrowing.book_id),
            students: students?.filter(s => borrowing.student_ids?.includes(s.id))
          })),
          selectedClass: selectedClassName
        };
        await generatePDFReport(groupBorrowingsData, `Group Borrowings Report - ${selectedClassName}`, 'group_borrowings');
        return;
      
      default:
        return;
    }

    await generatePDFReport(reportData, title, reportType);
  };

  const getReportStats = () => {
    const filteredBorrowings = getFilteredBorrowings();
    const filteredStudents = getFilteredStudents();
    
    const totalBorrowings = filteredBorrowings?.length || 0;
    const activeBorrowings = filteredBorrowings?.filter(b => b.status === 'active').length || 0;
    const overdueCount = getOverdueBooks().length;
    const totalBooks = books?.length || 0;
    
    // Use the correct student count based on selection
    const totalStudentsInClass = selectedClass === 'all' 
      ? students.length // Use the full students array length for 'all' selection
      : filteredStudents.length; // Use filtered students for specific class

    return { totalBorrowings, activeBorrowings, overdueCount, totalBooks, totalStudentsInClass };
  };

  const stats = getReportStats();

  // Render the selected report type
  const renderSelectedReport = () => {
    if (selectedReportType === 'lost_books') {
      return <LostBooksReport onGeneratePDF={generateLostBooksReport} />;
    }
    if (selectedReportType === 'theft_reports') {
      return <TheftReportsView onGeneratePDF={() => generateTheftReport()} />;
    }
    if (selectedReportType === 'group_borrowings') {
      return <GroupBorrowingReport selectedClass={selectedClass} />;
    }
    return null;
  };

  // Enhanced function to generate lost books PDF report with better data handling
  const generateLostBooksReport = async () => {
    console.log('Generating lost books PDF report...');
    console.log('Lost books data:', lostBooks);
    
    if (!lostBooks || lostBooks.length === 0) {
      toast({
        title: "No Data",
        description: "There are no lost books to include in the report.",
        variant: "default"
      });
      return;
    }

    // Filter by class if needed
    const filteredLostBooks = selectedClass === 'all' 
      ? lostBooks 
      : lostBooks.filter(book => {
          return book.students?.class_id === selectedClass;
        });

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

    const selectedClassName = selectedClass === 'all' 
      ? 'All Classes' 
      : availableClasses?.find(cls => cls.id === selectedClass)?.class_name || 'Unknown Class';

    const reportData = {
      lostBooks: filteredLostBooks,
      studentLostBooks: sortedStudentLostBooks,
      totalReplacementCost,
      selectedClass: selectedClassName
    };

    console.log('Report data being sent to PDF generator:', reportData);
    await generatePDFReport(reportData, `Lost Books Report - ${selectedClassName}`, 'lost_books');
  };

  const generateTheftReport = async () => {
    try {
      // Fetch theft reports data
      const { data: theftReports, error } = await supabase
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
        `)
        .order('created_at', { ascending: false });

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
        statusStats
      };

      await generatePDFReport(reportData, 'Official Theft Investigation Report', 'theft_reports');
      
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

  if (classesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading classes data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-600">Generate and download detailed library reports for your classes</p>
        {availableClasses.length > 0 && (
          <div className="mt-2 text-sm text-green-600">
            ✨ Found {availableClasses.length} classes with students: {availableClasses.slice(0, 3).map(cls => cls.class_name).join(', ')}
            {availableClasses.length > 3 && ` and ${availableClasses.length - 3} more`}
          </div>
        )}
      </div>

      {/* Class Filter */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Filter by Class
            <span className="text-sm font-normal text-gray-600 ml-2">
              ({availableClasses.length} classes with students)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex-1 max-w-md">
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">All Classes</span>
                      <span className="text-gray-500">({students.length} students)</span>
                    </div>
                  </SelectItem>
                  {availableClasses.map((cls) => {
                    const studentsInClass = students?.filter(student => 
                      student.class_id === cls.id
                    ).length || 0;
                    
                    return (
                      <SelectItem key={cls.id} value={cls.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="font-medium">{cls.class_name}</span>
                          <span className="text-gray-500">({studentsInClass} students)</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-gray-600 bg-white px-3 py-2 rounded-md border">
              {selectedClass === 'all' 
                ? `📊 Viewing data for all ${stats.totalStudentsInClass} students`
                : `📊 Viewing data for ${stats.totalStudentsInClass} students in ${availableClasses?.find(cls => cls.id === selectedClass)?.class_name}`
              }
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Report Content */}
      {renderSelectedReport()}

      {/* Quick Stats */}
      {!selectedReportType && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-blue-600">{stats.totalBooks}</p>
                <p className="text-sm text-gray-600">Total Books in Library</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-purple-100 rounded-full">
                    <Users className="w-4 h-4 text-purple-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-purple-600">{stats.totalStudentsInClass}</p>
                <p className="text-sm text-gray-600">
                  {selectedClass === 'all' ? 'Total Students' : `Students in ${availableClasses?.find(cls => cls.id === selectedClass)?.class_name || 'Selected Class'}`}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-green-100 rounded-full">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-green-600">{stats.totalBorrowings}</p>
                <p className="text-sm text-gray-600">
                  {selectedClass === 'all' ? 'All Borrowings' : 'Class Borrowings'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-orange-100 rounded-full">
                    <Calendar className="w-4 h-4 text-orange-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-orange-600">{stats.activeBorrowings}</p>
                <p className="text-sm text-gray-600">
                  {selectedClass === 'all' ? 'Currently Borrowed' : 'Active in Class'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-red-100 rounded-full">
                    <Calendar className="w-4 h-4 text-red-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-red-600">{stats.overdueCount}</p>
                <p className="text-sm text-gray-600">
                  {selectedClass === 'all' ? 'Overdue Books' : 'Overdue in Class'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Generation */}
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-green-600" />
            Generate Reports
            {selectedClass !== 'all' && (
              <span className="text-sm font-normal text-green-700 bg-green-100 px-2 py-1 rounded-full">
                For {availableClasses?.find(cls => cls.id === selectedClass)?.class_name}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                <SelectTrigger className="bg-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Choose the type of report to generate" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <type.icon className="w-4 h-4" />
                        <span>{type.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={() => generateReport(selectedReportType)}
              disabled={!selectedReportType || selectedReportType === 'lost_books'}
              className="bg-green-600 hover:bg-green-700 px-6"
            >
              <Download className="w-4 h-4 mr-2" />
              Generate PDF Report
            </Button>
          </div>
          
          {selectedClass !== 'all' && selectedReportType && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-blue-900">
                    Class-Specific Report Selected
                  </div>
                  <div className="text-sm text-blue-700">
                    This report will include data only for students in <strong>{availableClasses?.find(cls => cls.id === selectedClass)?.class_name}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedReportType && (
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
          )}
        </CardContent>
      </Card>

      {/* Report Types Grid */}
      {!selectedReportType && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportTypes.map((report) => {
            const Icon = report.icon;
            const filteredData = (() => {
              switch (report.id) {
                case 'overdue_books': return getOverdueBooks();
                case 'popular_books': return getPopularBooks();
                case 'student_activity': return getStudentActivity();
                case 'borrowing_history': return getFilteredBorrowings();
                case 'fine_collection': return fineCollection || [];
                case 'lost_books': return [];
                case 'group_borrowings': return filteredGroupBorrowings;
                default: return [];
              }
            })();
            
            return (
              <Card key={report.id} className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-transparent hover:border-l-blue-500">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div 
                      className={`w-12 h-12 ${report.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1">{report.title}</h3>
                      <p className="text-sm text-gray-600 mb-3 leading-relaxed">{report.description}</p>
                      {report.id === 'student_activity' && (
                        <div className="text-xs text-gray-500 mt-1">
                          {getFilteredStudents().length} students
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 mb-3">
                        <div className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                          {selectedClass === 'all' ? 'All Classes' : availableClasses?.find(cls => cls.id === selectedClass)?.class_name}
                        </div>
                        {report.id === 'fine_collection' && isLoadingFines ? (
                          <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center">
                            <svg className="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Loading...
                          </div>
                        ) : filteredData.length > 0 && (
                          <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            {filteredData.length} records
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4 group-hover:bg-blue-600 group-hover:text-white transition-colors" 
                    variant="outline"
                    disabled={report.id === 'fine_collection' && isLoadingFines}
                    onClick={() => {
                      setSelectedReportType(report.id);
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {report.id === 'lost_books' ? 'View Report' : 'Generate Report'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {availableClasses.length === 0 && (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Found</h3>
            <p className="text-gray-600 mb-4">
              It looks like there are no classes with students assigned to them yet.
            </p>
            <div>
              Please ensure students are properly assigned to classes using their class_id to see class-specific reports here.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
