import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Users, Eye, Edit, Trash2, AlertCircle, Book, GraduationCap } from 'lucide-react';
import { useStudents, useCreateStudent, useUpdateStudent, useDeleteStudent } from '@/hooks/useStudents';
import { useStudentsOffline, useCreateStudentOffline, useUpdateStudentOffline, useDeleteStudentOffline } from '@/hooks/useStudentsOffline';
import { useOptimizedStudents } from '@/hooks/useOptimizedStudents';
import { useFilteredStudentsWithClasses, useClassesWithStudents } from '@/hooks/useStudentsWithClasses';
import { useConnectivity } from '@/hooks/useConnectivity';

import { StudentForm } from './StudentForm';
import { StudentDetails } from './StudentDetails';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination';
import { ErrorDialog } from '@/components/ui/error-dialog';

interface StudentManagementProps {
  searchTerm?: string;
  openAddStudentForm?: boolean;
}

export const StudentManagement = ({ searchTerm = '', openAddStudentForm = false }: StudentManagementProps) => {
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [viewingStudent, setViewingStudent] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{
    title: string;
    description: string;
    errorType: "borrowing" | "foreign_key" | "general";
    studentId?: string;
    studentName?: string;
    borrowings?: Array<{
      id: string;
      tracking_code?: string;
      book_title?: string;
    }>;
  }>({
    title: "Error",
    description: "An error occurred",
    errorType: "general"
  });

  // Define effectiveSearchTerm here at the top
  const effectiveSearchTerm = searchTerm || localSearchTerm;
  
  const connectivity = useConnectivity();
  const isOnline = connectivity.isOnline;
  
  // Use enhanced hooks for proper student-class data with client-side search filtering
  const { 
    data: studentsWithClasses, 
    isLoading: studentsLoading 
  } = useFilteredStudentsWithClasses({
    includeClasses: true,
    filters: {
      search: effectiveSearchTerm,
      status: selectedStatus === 'all' ? undefined : selectedStatus
    }
  });
  
  const { 
    data: classesData, 
    isLoading: classesLoading 
  } = useClassesWithStudents();
  
  // Use the enhanced student data with class relationships
  const students = studentsWithClasses || [];
  
  // Calculate student statistics from local data
  const studentStats = useMemo(() => {
    if (!students || students.length === 0) {
      return { active: 0, inactive: 0, total: 0 };
    }
    
    const active = students.filter(s => s.status === 'active').length;
    const inactive = students.filter(s => s.status === 'inactive').length;
    const total = students.length;
    
    return { active, inactive, total };
  }, [students]);
  
  const createStudentMutation = useCreateStudentOffline();
  const updateStudentMutation = useUpdateStudentOffline();
  const deleteStudentMutation = useDeleteStudentOffline();

  // Use external search term when provided
  useEffect(() => {
    if (searchTerm) {
      setLocalSearchTerm(searchTerm);
    }
  }, [searchTerm]);

  // Reset to first page when search term or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [localSearchTerm, selectedStatus]);

  // Open add student form if requested
  useEffect(() => {
    if (openAddStudentForm) {
      setIsAddModalOpen(true);
    }
  }, [openAddStudentForm]);

  // Calculate accurate student statistics first
  const activeStudents = studentStats?.active || 0;
  const inactiveStudents = studentStats?.inactive || 0;
  const totalStudents = studentStats?.total || students?.length || 0;

  // Students are already filtered by the hook, no additional filtering needed
  const filteredStudents = students || [];

  // Calculate pagination
  const totalItems = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  
  // Ensure current page is within valid range
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  if (currentPage !== validCurrentPage) {
    setCurrentPage(validCurrentPage);
  }
  
  // Get current page items - pure client-side pagination
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentItems = filteredStudents.slice(startIndex, endIndex);

  // Debug information
  console.log('Pagination Debug:', {
    totalStudents: students?.length || 0,
    filteredStudents: filteredStudents.length,
    currentPage,
    validCurrentPage,
    itemsPerPage,
    totalPages,
    startIndex,
    endIndex,
    currentItemsCount: currentItems.length
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'graduated':
        return 'bg-blue-100 text-blue-800';
      case 'transferred':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusDisplayText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'graduated':
        return 'Graduated';
      case 'transferred':
        return 'Transferred';
      default:
        return 'Active';
    }
  };

  const handleCreateStudent = async (studentData: any) => {
    try {
      await createStudentMutation.mutateAsync(studentData);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Failed to create student:', error);
    }
  };

  const handleUpdateStudent = async (studentData: any) => {
    if (editingStudent) {
      await updateStudentMutation.mutateAsync({ id: editingStudent.id, ...studentData });
      setEditingStudent(null);
    }
  };

  const handleGraduateStudent = async (student: any) => {
    try {
      await updateStudentMutation.mutateAsync({ 
        id: student.id, 
        ...student,
        status: 'inactive' // Mark as inactive (graduated)
      });
      // Refresh data after graduation
      handleRefresh();
    } catch (error) {
      console.error('Failed to graduate student:', error);
    }
  };

  const handleRefresh = () => {
    // Refresh both students and classes data
    // The hooks will handle the actual refresh
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      await deleteStudentMutation.mutateAsync(id);
      // Refresh data after deletion
      handleRefresh();
    } catch (error: any) {
      console.error('Failed to delete student:', error);
      
      // Parse error message to determine type
      const errorMessage = error.message || '';
      
      if (errorMessage.includes('active borrowings')) {
        // Extract borrowing information from error message if available
        let borrowings: Array<{id: string, tracking_code?: string, book_title?: string}> = [];
        
        // Try to extract book titles from the error message
        const bookTitlesMatch = errorMessage.match(/active (?:borrowing|borrowings): (.*?)\./);
        if (bookTitlesMatch && bookTitlesMatch[1]) {
          const bookTitles = bookTitlesMatch[1].split(', ');
          borrowings = bookTitles.map((title, index) => ({
            id: `temp-${index}`,
            book_title: title
          }));
        }
        
        // Get student name from error message
        let studentName = '';
        const studentNameMatch = errorMessage.match(/([A-Za-z]+ [A-Za-z]+) has \d+/);
        if (studentNameMatch && studentNameMatch[1]) {
          studentName = studentNameMatch[1];
        }
        
        setErrorDetails({
          title: "Cannot Delete Student",
          description: "This student has active borrowings that must be returned first.",
          errorType: "borrowing",
          studentId: id,
          studentName,
          borrowings
        });
        setErrorDialogOpen(true);
      } else if (errorMessage.includes('violates foreign key constraint')) {
        setErrorDetails({
          title: "Cannot Delete Student Record",
          description: "This student has borrowing history in the system. Please archive the student instead of deleting.",
          errorType: "foreign_key",
          studentId: id
        });
        setErrorDialogOpen(true);
      } else {
        setErrorDetails({
          title: "Deletion Failed",
          description: errorMessage || "An unexpected error occurred while deleting the student record.",
          errorType: "general"
        });
        setErrorDialogOpen(true);
      }
    }
  };

  const generatePaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    
    // Always show first page
    items.push(
      <PaginationItem key="first">
        <PaginationLink 
          isActive={currentPage === 1} 
          onClick={(e) => {
            e.preventDefault();
            setCurrentPage(1);
          }}
        >
          1
        </PaginationLink>
      </PaginationItem>
    );

    // Calculate range of visible page numbers
    let startPage = Math.max(2, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 2);
    
    if (endPage - startPage < maxVisiblePages - 2) {
      startPage = Math.max(2, endPage - (maxVisiblePages - 2));
    }

    // Add ellipsis after first page if needed
    if (startPage > 2) {
      items.push(
        <PaginationItem key="ellipsis-start">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    // Add middle pages
    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink 
            isActive={currentPage === i}
            onClick={(e) => {
              e.preventDefault();
              setCurrentPage(i);
            }}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    // Add ellipsis before last page if needed
    if (endPage < totalPages - 1) {
      items.push(
        <PaginationItem key="ellipsis-end">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    // Always show last page if there's more than one page
    if (totalPages > 1) {
      items.push(
        <PaginationItem key="last">
          <PaginationLink 
            isActive={currentPage === totalPages}
            onClick={(e) => {
              e.preventDefault();
              setCurrentPage(totalPages);
            }}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  const openAddStudentModal = () => {
    // Force a refresh of the classes data before opening the modal
    // This ensures we have the latest classes when the form loads
    setIsAddModalOpen(true);
  };

  if (viewingStudent) {
    return (
      <StudentDetails 
        student={viewingStudent} 
        onBack={() => setViewingStudent(null)} 
      />
    );
  }

  if (studentsLoading) {
    return <div className="flex items-center justify-center p-8">Loading students...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Student Management</h2>
          <p className="text-muted-foreground">
            Manage student records with proper class associations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm">
            {connectivity.isOnline ? (
              <>
                <div className="h-2 w-2 bg-green-500 rounded-full" />
                <span className="text-green-600">Online</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 bg-orange-500 rounded-full" />
                <span className="text-orange-600">Offline</span>
              </>
            )}
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <Users className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openAddStudentModal} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Student
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">
              {totalStudents === 1 ? 'student' : 'students'} across {classesData?.length || 0} classes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Source</CardTitle>
            <div className={`h-2 w-2 rounded-full ${connectivity.isOnline ? 'bg-green-500' : 'bg-orange-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {connectivity.isOnline ? 'Supabase' : 'Local SQLite'}
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time sync
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
            <Book className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{classesData?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Across all grades</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {!searchTerm && (
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search students by name, admission number, or class..."
                  value={localSearchTerm}
                  onChange={(e) => setLocalSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
            <div className="flex items-center gap-4">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select 
                value={itemsPerPage.toString()} 
                onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Items per page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Student</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Admission No.</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Class</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? (
                  currentItems.map((student) => (
                    <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="font-medium text-gray-900">
                          {student.first_name} {student.last_name}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-700">{student.admission_number}</td>
                      <td className="py-4 px-4 text-gray-700">
                        {student.class?.class_name || student.class_grade || 'Not Assigned'}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(student.status || 'active')}>
                            {getStatusDisplayText(student.status)}
                          </Badge>
                          {student.status === 'inactive' && student.class?.is_active === false && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              Class Graduated
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setViewingStudent(student)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setEditingStudent(student)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {student.status === 'active' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-blue-600 hover:text-blue-700">
                                  <GraduationCap className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2 text-blue-600">
                                    <GraduationCap className="h-5 w-5" />
                                    Graduate Student
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="space-y-2">
                                    <p>
                                      Are you sure you want to mark {student.first_name} {student.last_name} as graduated?
                                    </p>
                                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800">
                                      <p className="font-medium flex items-center gap-1.5">
                                        <AlertCircle className="h-4 w-4" />
                                        What happens when a student graduates:
                                      </p>
                                      <ul className="mt-1 ml-5 list-disc text-sm space-y-1">
                                        <li>Student status will be changed to "Inactive"</li>
                                        <li>Student will no longer be able to borrow books</li>
                                        <li>Student will be hidden from borrowing forms</li>
                                        <li>You can reactivate the student later if needed</li>
                                      </ul>
                                    </div>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleGraduateStudent(student)}
                                    className="bg-blue-600 hover:bg-blue-700"
                                  >
                                    Graduate Student
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                  <AlertCircle className="h-5 w-5" />
                                  Delete Student Record
                                </AlertDialogTitle>
                                <AlertDialogDescription className="space-y-2">
                                  <p>
                                    Are you sure you want to delete {student.first_name} {student.last_name}'s record? 
                                  This action cannot be undone.
                                  </p>
                                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
                                    <p className="font-medium flex items-center gap-1.5">
                                      <AlertCircle className="h-4 w-4" />
                                      Important Notice:
                                    </p>
                                    <ul className="mt-1 ml-5 list-disc text-sm space-y-1">
                                      <li>Students with active borrowings cannot be deleted</li>
                                      <li>Students must return all library materials first</li>
                                      <li>Consider deactivating the student instead of deletion</li>
                                    </ul>
                                  </div>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteStudent(student.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No students found matching your search criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {filteredStudents.length > 0 && (
            <div className="mt-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-500">
                  Showing {startIndex + 1} to {endIndex} of {totalItems} students
                </div>
                <Pagination className="border rounded-md p-1 bg-gray-50">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(prev => Math.max(1, prev - 1));
                        }}
                        className={validCurrentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    
                    {generatePaginationItems()}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(prev => Math.min(totalPages, prev + 1));
                        }}
                        className={validCurrentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Student Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Student
            </DialogTitle>
          </DialogHeader>
          <StudentForm
            onSubmit={handleCreateStudent}
            onCancel={() => setIsAddModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={!!editingStudent} onOpenChange={() => setEditingStudent(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Student
            </DialogTitle>
          </DialogHeader>
          {editingStudent && (
            <StudentForm
              student={editingStudent}
              onSubmit={handleUpdateStudent}
              onCancel={() => setEditingStudent(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <ErrorDialog
        open={errorDialogOpen}
        onOpenChange={setErrorDialogOpen}
        title={errorDetails.title}
        description={errorDetails.description}
        errorType={errorDetails.errorType}
        studentId={errorDetails.studentId}
        studentName={errorDetails.studentName}
        borrowings={errorDetails.borrowings}
      />
    </div>
  );
};
