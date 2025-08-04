import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Users, Eye, Edit, Trash2, AlertCircle } from 'lucide-react';
import { useStudents, useCreateStudent, useUpdateStudent, useDeleteStudent } from '@/hooks/useStudents';
import { useStudentsOffline, useCreateStudentOffline, useUpdateStudentOffline, useDeleteStudentOffline } from '@/hooks/useStudentsOffline';
import { useOptimizedStudents } from '@/hooks/useOptimizedStudents';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  
  // Use the offline-first hook for better performance and offline capability
  const { data: studentsData, isLoading: studentsLoading } = useStudentsOffline();
  
  // Use the enhanced useStudents hook with fetchAll=true as fallback for statistics
  const { data: studentsResponse, isLoading } = useStudents({ 
    fetchAll: true, 
    searchTerm: effectiveSearchTerm 
  });
  
  const { data: optimizedStudentsData, isLoading: optimizedLoading } = useOptimizedStudents(1, 10); // Get total count
  
  // Prefer offline data, fallback to online data
  const students = Array.isArray(studentsData) ? studentsData : 
                  Array.isArray(studentsResponse?.students) ? studentsResponse.students : [];
  
  // Get accurate student statistics
  const { data: studentStats } = useQuery({
    queryKey: ['student-statistics'],
    queryFn: async () => {
      const [activeResult, inactiveResult, totalResult] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'inactive'),
        supabase.from('students').select('*', { count: 'exact', head: true })
      ]);
      
      return {
        active: activeResult.count || 0,
        inactive: inactiveResult.count || 0,
        total: totalResult.count || 0
      };
    }
  });
  
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
  const totalStudents = studentStats?.total || optimizedStudentsData?.totalCount || students?.length || 0;

  // Filter students client-side for status and search
  const filteredStudents = students?.filter(student => {
    // If we're already filtering by search term at the server level, just check status
    const matchesStatus = selectedStatus === 'all' || student.status === selectedStatus;
    
    // If effectiveSearchTerm is used at the server level with fetchAll=false, 
    // we don't need to filter by search term here
    return matchesStatus;
  }) || [];

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

  const handleDeleteStudent = async (studentId: string) => {
    try {
    await deleteStudentMutation.mutateAsync(studentId);
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
          studentId,
          studentName,
          borrowings
        });
        setErrorDialogOpen(true);
      } else if (errorMessage.includes('violates foreign key constraint')) {
        setErrorDetails({
          title: "Cannot Delete Student Record",
          description: "This student has borrowing history in the system. Please archive the student instead of deleting.",
          errorType: "foreign_key",
          studentId
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Generate pagination items
  const generatePaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    
    // Always show first page
    items.push(
      <PaginationItem key="first">
        <PaginationLink 
          isActive={validCurrentPage === 1} 
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
    let startPage = Math.max(2, validCurrentPage - Math.floor(maxVisiblePages / 2));
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
            isActive={validCurrentPage === i}
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
            isActive={validCurrentPage === totalPages}
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

  if (isLoading || optimizedLoading) {
    return <div className="flex items-center justify-center p-8">Loading students...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Student Management</h1>
          <p className="text-gray-600">Manage student records and information</p>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={openAddStudentModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
            </DialogHeader>
            <StudentForm
              onSubmit={handleCreateStudent}
              onCancel={() => setIsAddModalOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-3xl font-bold text-gray-900">{totalStudents}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Students</p>
                <p className="text-3xl font-bold text-green-600">{activeStudents}</p>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactive Students</p>
                <p className="text-3xl font-bold text-red-600">{inactiveStudents}</p>
              </div>
              <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
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
                      <td className="py-4 px-4 text-gray-700">{student.class_grade}</td>
                      <td className="py-4 px-4">
                        <Badge className={getStatusColor(student.status || 'active')}>
                          {student.status || 'Active'}
                        </Badge>
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

      {/* Edit Student Dialog */}
      <Dialog open={!!editingStudent} onOpenChange={() => setEditingStudent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
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
