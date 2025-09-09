import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GraduationCap, Search, Eye, BookOpen, Currency, Calendar } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePayFine } from '@/hooks/useFineManagement';
import { useBookReturn } from '@/hooks/useBorrowings';
import { formatCurrency } from '@/lib/utils';

export const GraduatedStudentsManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const payFine = usePayFine();
  const bookReturn = useBookReturn();

  // Fetch graduated students with their borrowing and fine status
  const { data: graduatedStudents = [], isLoading } = useQuery({
    queryKey: ['graduated-students', searchTerm, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('students')
        .select(`
          *,
          borrowings!inner (
            id,
            status,
            due_date,
            is_lost,
            tracking_code,
            books (title, author)
          ),
          fines (
            id,
            amount,
            status,
            fine_type,
            description
          )
        `)
        .eq('status', 'graduated')
        .order('first_name');

      // Apply search filter if search term exists
      if (searchTerm) {
        query = query.or(
          `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,admission_number.ilike.%${searchTerm}%`
        );
      }

      const { data, error, count } = await query;

      if (error) throw error;
      return data || [];
    },
  });

  const filteredStudents = useMemo(() => {
    return graduatedStudents.filter(student => {
      const matchesSearch = student.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          student.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          student.admission_number?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      if (statusFilter === 'pending-returns') {
        return student.borrowings?.some(b => b.status === 'active');
      }
      if (statusFilter === 'pending-fines') {
        return student.fines?.some(f => f.status === 'unpaid');
      }
      
      return true;
    });
  }, [graduatedStudents, searchTerm, statusFilter]);

  // Calculate pagination
  const totalItems = filteredStudents.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + pageSize);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of the table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle page size change
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const handleMarkFineAsPaid = async (fineId: string, studentName: string) => {
    try {
      await payFine.mutateAsync(fineId);
      queryClient.invalidateQueries({ queryKey: ['graduated-students'] });
    } catch (error) {
      console.error('Error paying fine:', error);
    }
  };

  const handleProcessReturn = async (borrowingId: string, studentName: string, trackingCode: string) => {
    try {
      await bookReturn.mutateAsync({
        id: borrowingId,
        condition_at_return: 'good',
        fine_amount: 0,
        notes: `Graduated student return processed for ${studentName}`,
        is_lost: false,
        returned_tracking_code: trackingCode,
        prevent_auto_fine: true // Prevent auto-fine for graduated students
      });
      
      queryClient.invalidateQueries({ queryKey: ['graduated-students'] });
      
      toast({
        title: 'Success',
        description: `Book return processed for ${studentName}`,
      });
    } catch (error) {
      console.error('Error processing return:', error);
      toast({
        title: 'Error',
        description: 'Failed to process book return',
        variant: 'destructive',
      });
    }
  };

  const handleMarkBookLost = async (borrowingId: string, studentName: string) => {
    try {
      await bookReturn.mutateAsync({
        id: borrowingId,
        condition_at_return: 'lost',
        fine_amount: 500, // Standard lost book fine
        notes: `Book marked as lost for graduated student ${studentName}`,
        is_lost: true,
        prevent_auto_fine: true
      });
      
      queryClient.invalidateQueries({ queryKey: ['graduated-students'] });
      
      toast({
        title: 'Success',
        description: `Book marked as lost for ${studentName}`,
      });
    } catch (error) {
      console.error('Error marking book as lost:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark book as lost',
        variant: 'destructive',
      });
    }
  };

  const getStudentObligations = (student: any) => {
    const activeBorrowings = student.borrowings?.filter(b => b.status === 'active') || [];
    const unpaidFines = student.fines?.filter(f => f.status === 'unpaid') || [];
    const totalFineAmount = unpaidFines.reduce((sum, fine) => sum + parseFloat(fine.amount || 0), 0);

    return { activeBorrowings, unpaidFines, totalFineAmount };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading graduated students...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600">Manage alumni records, outstanding books, and fine collections</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by name or admission number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Graduated</SelectItem>
                <SelectItem value="pending-returns">Pending Returns</SelectItem>
                <SelectItem value="pending-fines">Pending Fines</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Graduated Students Table */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle>Graduated Students ({filteredStudents.length})</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Rows per page:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => handlePageSizeChange(Number(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Graduation Year</TableHead>
                  <TableHead>Pending Returns</TableHead>
                  <TableHead>Outstanding Fines</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStudents.map((student) => {
                  const { activeBorrowings, unpaidFines, totalFineAmount } = getStudentObligations(student);
                  
                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="font-medium">{student.first_name} {student.last_name}</div>
                        <div className="text-sm text-gray-500">Alumni</div>
                      </TableCell>
                      <TableCell>{student.admission_number}</TableCell>
                      <TableCell>{student.academic_year}</TableCell>
                      <TableCell>
                        {activeBorrowings.length > 0 ? (
                          <Badge variant="destructive">{activeBorrowings.length} books</Badge>
                        ) : (
                          <Badge variant="secondary">None</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {totalFineAmount > 0 ? (
                          <Badge variant="destructive">{formatCurrency(totalFineAmount)}</Badge>
                        ) : (
                          <Badge variant="secondary">None</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {/* Process returns for each active borrowing */}
                          {activeBorrowings.map((borrowing) => (
                            <div key={borrowing.id} className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleProcessReturn(
                                  borrowing.id, 
                                  `${student.first_name} ${student.last_name}`,
                                  borrowing.tracking_code
                                )}
                                disabled={bookReturn.isPending}
                              >
                                <BookOpen className="w-4 h-4 mr-1" />
                                Return
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleMarkBookLost(
                                  borrowing.id, 
                                  `${student.first_name} ${student.last_name}`
                                )}
                                disabled={bookReturn.isPending}
                              >
                                Mark Lost
                              </Button>
                            </div>
                          ))}
                          
                          {/* Pay fines */}
                          {unpaidFines.map((fine) => (
                            <Button
                              key={fine.id}
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkFineAsPaid(fine.id, `${student.first_name} ${student.last_name}`)}
                              disabled={payFine.isPending}
                            >
                              <Currency className="w-4 h-4 mr-1" />
                              Pay {formatCurrency(parseFloat(fine.amount))}
                            </Button>
                          ))}
                          
                          {activeBorrowings.length === 0 && unpaidFines.length === 0 && (
                            <Badge variant="secondary" className="text-green-700 bg-green-100">
                              All Clear ✓
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 px-4 py-3 border-t">
                <div className="text-sm text-gray-500">
                  Showing {startIndex + 1} to {Math.min(startIndex + pageSize, totalItems)} of {totalItems} students
                </div>
                <div className="flex space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                  >
                    «
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    ‹
                  </Button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Calculate page numbers to show (current page in the middle if possible)
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    ›
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    »
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
