import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GraduationCap, Search, BookOpen, DollarSign, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { usePayFine } from '@/hooks/useFineManagement';
import { useBookReturn } from '@/hooks/useBorrowings';
import { formatCurrency } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';

interface GraduatedStudent {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_grade?: string;
  email?: string;
  phone?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  activeBorrowings?: any[];
  unpaidFines?: any[];
  isCleared?: boolean;
  totalFineAmount?: number;
  activeBorrowingCount?: number;
  unpaidFineCount?: number;
}

interface GraduatedStudentResponse {
  students: GraduatedStudent[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface ClearanceData {
  has_active_borrowings: boolean;
  has_unpaid_fines: boolean;
  active_borrowing_count: number;
  unpaid_fine_count: number;
  total_fine_amount: number;
  active_borrowings?: BorrowingDetail[];
  unpaid_fines?: FineDetail[];
}

interface BorrowingDetail {
  id: string;
  book_copy_id?: string;
  borrowed_date?: string;
  due_date: string;
  tracking_code?: string;
  book_copy_title?: string;
  book_copy_author?: string;
  copy_identifier?: string;
  book_copy_tracking_code?: string;
  legacy_book_id?: number;
  book_title?: string;
  book_author?: string;
  book_legacy_id?: number;
}

interface FineDetail {
  id: string;
  amount: number;
  description?: string;
  fine_type: string;
  created_at: string;
  borrowing_id?: string;
}

export function GraduatedStudentsManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [clearanceFilter, setClearanceFilter] = useState<'all' | 'cleared' | 'not-cleared'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedStudent, setSelectedStudent] = useState<GraduatedStudent | null>(null);
  const [clearanceDetails, setClearanceDetails] = useState<ClearanceData | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutate: payFine } = usePayFine();
  const { mutate: returnBook } = useBookReturn();

  // Fetch graduated students from local database
  const { data: graduatedData, isLoading, error } = useQuery<GraduatedStudentResponse>({
    queryKey: ['graduated-students', currentPage, pageSize, searchTerm],
    queryFn: async () => {
      const result = await invoke<GraduatedStudentResponse>('get_graduated_students', {
        page: currentPage,
        pageSize: pageSize,
        searchTerm: searchTerm || null
      });
      
      // Fetch clearance data for all students in this page
      const studentsWithClearance = await Promise.all(
        result.students.map(async (student) => {
          try {
            const clearanceData = await invoke<ClearanceData>('get_student_clearance_data', { 
              studentId: student.id 
            });
            return {
              ...student,
              activeBorrowingCount: clearanceData.active_borrowing_count,
              unpaidFineCount: clearanceData.unpaid_fine_count,
              totalFineAmount: clearanceData.total_fine_amount,
              isCleared: !clearanceData.has_active_borrowings && !clearanceData.has_unpaid_fines,
            };
          } catch (error) {
            console.error(`Failed to fetch clearance for student ${student.id}:`, error);
            return {
              ...student,
              activeBorrowingCount: 0,
              unpaidFineCount: 0,
              totalFineAmount: 0,
              isCleared: false,
            };
          }
        })
      );
      
      return {
        ...result,
        students: studentsWithClearance,
      };
    },
  });

  // Fetch clearance data for a specific student
  const fetchClearanceData = async (studentId: string): Promise<ClearanceData> => {
    return await invoke<ClearanceData>('get_student_clearance_data', { studentId });
  };

  const handleReturnBook = async (borrowingId: string, studentId: string) => {
    try {
      await invoke('return_book', { borrowingId });
      toast({
        title: 'Success',
        description: 'Book returned successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['graduated-students'] });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to return book',
        variant: 'destructive',
      });
    }
  };

  const handlePayFine = async (fineId: string, studentId: string) => {
    try {
      await invoke('pay_fine', { fineId });
      toast({
        title: 'Success',
        description: 'Fine paid successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['graduated-students'] });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to pay fine',
        variant: 'destructive',
      });
    }
  };

  const handleViewDetails = async (student: GraduatedStudent) => {
    try {
      const clearanceData = await fetchClearanceData(student.id);
      setClearanceDetails(clearanceData);
      setSelectedStudent({
        ...student,
        activeBorrowingCount: clearanceData.active_borrowing_count,
        unpaidFineCount: clearanceData.unpaid_fine_count,
        totalFineAmount: clearanceData.total_fine_amount,
        isCleared: !clearanceData.has_active_borrowings && !clearanceData.has_unpaid_fines,
      });
      setIsDetailsDialogOpen(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch student details',
        variant: 'destructive',
      });
    }
  };

  const students = graduatedData?.students || [];
  
  // Apply clearance filter
  const filteredStudents = students.filter(student => {
    if (clearanceFilter === 'cleared') {
      return student.isCleared === true;
    } else if (clearanceFilter === 'not-cleared') {
      return student.isCleared === false;
    }
    return true; // 'all'
  });
  
  const totalPages = graduatedData?.total_pages || 1;
  const clearedCount = students.filter(s => s.isCleared).length;
  const notClearedCount = students.filter(s => !s.isCleared).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Graduated Students Management
          </CardTitle>
          <CardDescription>
            Manage graduated students and their clearance status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex-1 min-w-[300px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or admission number..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
            
            <Select 
              value={clearanceFilter} 
              onValueChange={(v: 'all' | 'cleared' | 'not-cleared') => {
                setClearanceFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    All Students
                  </div>
                </SelectItem>
                <SelectItem value="cleared">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Cleared Only
                  </div>
                </SelectItem>
                <SelectItem value="not-cleared">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    Not Cleared
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="25">25 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setClearanceFilter('all')}>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{graduatedData?.total_count || 0}</div>
                <p className="text-xs text-muted-foreground">Total Graduated</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setClearanceFilter('cleared')}>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">
                  {clearedCount}
                </div>
                <p className="text-xs text-muted-foreground">Cleared</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setClearanceFilter('not-cleared')}>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">
                  {notClearedCount}
                </div>
                <p className="text-xs text-muted-foreground">Pending Clearance</p>
              </CardContent>
            </Card>
          </div>

          {/* Active Filter Badge */}
          {clearanceFilter !== 'all' && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                Showing: {clearanceFilter === 'cleared' ? 'Cleared Students' : 'Not Cleared Students'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setClearanceFilter('all')}
                className="h-6 text-xs"
              >
                Clear Filter
              </Button>
            </div>
          )}

          {/* Students Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8 text-red-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              Error loading graduated students
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {clearanceFilter !== 'all' 
                ? `No ${clearanceFilter === 'cleared' ? 'cleared' : 'uncleared'} students found`
                : 'No graduated students found'
              }
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.admission_number}</TableCell>
                      <TableCell>{student.first_name} {student.last_name}</TableCell>
                      <TableCell>{student.class_grade || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{student.email || 'No email'}</div>
                          <div className="text-muted-foreground">{student.phone || 'No phone'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.isCleared ? (
                          <Badge className="bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Cleared
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(student)}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {clearanceFilter !== 'all' ? (
                    <>
                      Showing {filteredStudents.length} of {graduatedData?.total_count || 0} students
                      <span className="ml-1 text-primary">
                        ({clearanceFilter === 'cleared' ? 'Cleared' : 'Not Cleared'})
                      </span>
                    </>
                  ) : (
                    <>
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, graduatedData?.total_count || 0)} of {graduatedData?.total_count || 0} students
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Student Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Student Clearance Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedStudent && clearanceDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Name</p>
                  <p className="text-lg font-semibold">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Admission Number</p>
                  <p className="text-lg font-semibold">{selectedStudent.admission_number}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Class</p>
                  <p className="text-lg">{selectedStudent.class_grade || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Clearance Status</p>
                  <Badge className={selectedStudent.isCleared ? 'bg-green-600' : 'bg-red-600'}>
                    {selectedStudent.isCleared ? '✓ Cleared' : '⚠ Pending Clearance'}
                  </Badge>
                </div>
              </div>

              {/* Active Borrowings with Book Details */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5" />
                  Active Borrowings ({selectedStudent.activeBorrowingCount || 0})
                </h4>
                {clearanceDetails.active_borrowings && clearanceDetails.active_borrowings.length > 0 ? (
                  <div className="space-y-3">
                    {clearanceDetails.active_borrowings.map((borrowing) => (
                      <Card key={borrowing.id} className="bg-red-50 border-red-200">
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-lg">
                                  {borrowing.book_copy_title || borrowing.book_title || 'Unknown Title'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  by {borrowing.book_copy_author || borrowing.book_author || 'Unknown Author'}
                                </p>
                              </div>
                              <Badge variant="destructive" className="ml-2">Not Returned</Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 text-sm bg-white/50 p-3 rounded">
                              {(borrowing.legacy_book_id || borrowing.book_legacy_id) && (
                                <div className="col-span-2">
                                  <span className="font-semibold">Legacy Book ID:</span>{' '}
                                  <span className="font-mono bg-blue-100 px-2 py-1 rounded text-base">
                                    {borrowing.legacy_book_id || borrowing.book_legacy_id}
                                  </span>
                                </div>
                              )}
                              {borrowing.copy_identifier && (
                                <div>
                                  <span className="font-semibold">Copy ID:</span>{' '}
                                  <span className="font-mono">{borrowing.copy_identifier}</span>
                                </div>
                              )}
                              {(borrowing.tracking_code || borrowing.book_copy_tracking_code) && (
                                <div>
                                  <span className="font-semibold">Tracking Code:</span>{' '}
                                  <span className="font-mono">{borrowing.tracking_code || borrowing.book_copy_tracking_code}</span>
                                </div>
                              )}
                              {borrowing.borrowed_date && (
                                <div>
                                  <span className="font-semibold">Borrowed:</span>{' '}
                                  {new Date(borrowing.borrowed_date).toLocaleDateString()}
                                </div>
                              )}
                              {borrowing.due_date && (
                                <div className="text-red-600 font-semibold">
                                  <span>Due Date:</span>{' '}
                                  {new Date(borrowing.due_date).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            
                            <Button
                              size="sm"
                              onClick={() => handleReturnBook(borrowing.id, selectedStudent.id)}
                              className="w-full"
                            >
                              Mark as Returned
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <div className="text-sm text-muted-foreground bg-yellow-50 border border-yellow-200 rounded p-3">
                      ⚠️ All books must be returned before student clearance.
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded p-3">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>No active borrowings - All books returned</span>
                  </div>
                )}
              </div>

              {/* Unpaid Fines */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-lg">
                  <DollarSign className="h-5 w-5" />
                  Unpaid Fines ({selectedStudent.unpaidFineCount || 0})
                </h4>
                {clearanceDetails.unpaid_fines && clearanceDetails.unpaid_fines.length > 0 ? (
                  <div className="space-y-3">
                    {clearanceDetails.unpaid_fines.map((fine) => (
                      <Card key={fine.id} className="bg-yellow-50 border-yellow-200">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 space-y-1">
                              <p className="font-semibold text-lg text-red-600">
                                {formatCurrency(fine.amount)}
                              </p>
                              <p className="text-sm font-medium">
                                Type: {fine.fine_type.replace('_', ' ').toUpperCase()}
                              </p>
                              {fine.description && (
                                <p className="text-sm text-muted-foreground">{fine.description}</p>
                              )}
                              {fine.created_at && (
                                <p className="text-xs text-muted-foreground">
                                  Date: {new Date(fine.created_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handlePayFine(fine.id, selectedStudent.id)}
                            >
                              Pay Fine
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <div className="bg-red-100 border border-red-300 rounded p-4">
                      <p className="text-xl font-bold text-red-700">
                        Total Outstanding: {formatCurrency(selectedStudent.totalFineAmount || 0)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded p-3">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>No unpaid fines</span>
                  </div>
                )}
              </div>

              {/* Clearance Summary */}
              {selectedStudent.isCleared && (
                <div className="border-t pt-4">
                  <div className="bg-green-50 border border-green-300 rounded p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-semibold text-lg text-green-800">Student Cleared ✓</p>
                      <p className="text-sm text-green-700">
                        This student has returned all books and paid all fines. They are cleared for graduation.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
