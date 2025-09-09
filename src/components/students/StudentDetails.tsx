
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Calendar, User, RefreshCw, AlertTriangle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_grade: string;
  email?: string;
  phone?: string;
  address?: string;
  date_of_birth?: string;
  enrollment_date?: string;
  status?: string;
}

interface StudentDetailsProps {
  student: Student;
  onBack: () => void;
}

export const StudentDetails = ({ student, onBack }: StudentDetailsProps) => {
  const queryClient = useQueryClient();
  
  // Get student borrowing history from local database
  const { data: studentBorrowings = [], isLoading: borrowingsLoading, refetch: refetchBorrowings } = useQuery({
    queryKey: ['student-borrowings-local', student.id],
    queryFn: async () => {
      try {
        // Use Tauri command to get student borrowings from local database
        const borrowings = await invoke('get_borrowings_by_student', { studentId: student.id });
        return borrowings || [];
      } catch (error) {
        console.error('Failed to get student borrowings:', error);
        return [];
      }
    },
  });

  // Get student fines from local database
  const { data: fines = [], isLoading: finesLoading, refetch: refetchFines } = useQuery({
    queryKey: ['student-fines-local', student.id],
    queryFn: async () => {
      try {
        // Use Tauri command to get student fines from local database
        const fines = await invoke('get_fines_by_student', { studentId: student.id });
        return fines || [];
      } catch (error) {
        console.error('Failed to get student fines:', error);
        return [];
      }
    },
  });
  
  // Filter borrowings by status
  const activeBorrowings = studentBorrowings.filter((b: any) => b.status === 'active' || b.status === 'borrowed');
  const returnedBorrowings = studentBorrowings.filter((b: any) => b.status === 'returned');
  const overdueBorrowings = studentBorrowings.filter((b: any) => {
    if (b.status !== 'active' && b.status !== 'borrowed') return false;
    if (!b.due_date) return false;
    return new Date(b.due_date) < new Date();
  });

  const unpaidFines = fines.filter((f: any) => f.status === 'unpaid');
  const totalUnpaidAmount = unpaidFines.reduce((sum: number, fine: any) => sum + (fine.amount || 0), 0);

  // Refresh function to clear cache and refetch data
  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['student-borrowings-local', student.id] });
    await queryClient.invalidateQueries({ queryKey: ['student-fines-local', student.id] });
    await Promise.all([refetchBorrowings(), refetchFines()]);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getBorrowingStatusColor = (borrowing: any) => {
    if (borrowing.status === 'returned') return 'bg-green-100 text-green-800';
    if (borrowing.status !== 'active' && borrowing.status !== 'borrowed') return 'bg-gray-100 text-gray-800';
    const dueDate = new Date(borrowing.due_date);
    if (dueDate < new Date()) return 'bg-red-100 text-red-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getBorrowingStatus = (borrowing: any) => {
    if (borrowing.status === 'returned') return 'Returned';
    if (borrowing.status !== 'active' && borrowing.status !== 'borrowed') return borrowing.status || 'Unknown';
    const dueDate = new Date(borrowing.due_date);
    if (dueDate < new Date()) return 'Overdue';
    return 'Active';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack} size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Students
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {student.first_name} {student.last_name}
            </h1>
            <p className="text-gray-600">Admission Number: {student.admission_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={borrowingsLoading || finesLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${(borrowingsLoading || finesLoading) ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
          <Badge className={getStatusColor(student.status || 'active')}>
            {student.status || 'active'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Information */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Student Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">First Name</label>
                  <p className="text-gray-900">{student.first_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Name</label>
                  <p className="text-gray-900">{student.last_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Admission Number</label>
                  <p className="text-gray-900">{student.admission_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Class</label>
                  <p className="text-gray-900">{student.class_grade}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <Badge className={getStatusColor(student.status || 'active')}>
                    {student.status || 'active'}
                  </Badge>
                </div>
              </div>

              {student.email && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-gray-900">{student.email}</p>
                </div>
              )}

              {student.phone && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Phone</label>
                  <p className="text-gray-900">{student.phone}</p>
                </div>
              )}

              {student.address && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Address</label>
                  <p className="text-gray-900">{student.address}</p>
                </div>
              )}

              {student.date_of_birth && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                  <p className="text-gray-900">{formatDate(student.date_of_birth)}</p>
                </div>
              )}

              {student.enrollment_date && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Enrollment Date</label>
                  <p className="text-gray-900">{formatDate(student.enrollment_date)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Borrowing Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Borrowings</span>
                <span className="font-semibold">{studentBorrowings.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Active Borrowings</span>
                <span className="font-semibold text-blue-600">{activeBorrowings.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Overdue Books</span>
                <span className="font-semibold text-red-600">{overdueBorrowings.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Returned Books</span>
                <span className="font-semibold text-green-600">{returnedBorrowings.length}</span>
              </div>
            </CardContent>
          </Card>

          {unpaidFines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Outstanding Fines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">
                    KES {totalUnpaidAmount.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {unpaidFines.length} unpaid fine{unpaidFines.length > 1 ? 's' : ''}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Borrowing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Active Borrowings ({activeBorrowings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {borrowingsLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-gray-400 mb-4" />
              <p className="text-gray-500">Loading borrowing history...</p>
            </div>
          ) : activeBorrowings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Book</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Borrowed Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Due Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBorrowings.map((borrowing: any) => (
                    <tr key={borrowing.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">{borrowing.books?.title || 'Unknown Book'}</div>
                          <div className="text-sm text-gray-600">{borrowing.books?.author || 'Unknown Author'}</div>
                          {borrowing.book_copies?.legacy_book_id && (
                            <div className="text-xs text-gray-500">ID: {borrowing.book_copies.legacy_book_id}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-700">{formatDate(borrowing.borrowed_date)}</td>
                      <td className="py-3 px-4 text-gray-700">{formatDate(borrowing.due_date)}</td>
                      <td className="py-3 px-4">
                        <Badge className={getBorrowingStatusColor(borrowing)}>
                          {getBorrowingStatus(borrowing)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No active borrowings found for this student.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Complete Borrowing History */}
      {studentBorrowings.length > activeBorrowings.length && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Complete Borrowing History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Book</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Borrowed Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Due Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Return Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {studentBorrowings.map((borrowing: any) => (
                    <tr key={borrowing.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">{borrowing.books?.title || 'Unknown Book'}</div>
                          <div className="text-sm text-gray-600">{borrowing.books?.author || 'Unknown Author'}</div>
                          {borrowing.book_copies?.legacy_book_id && (
                            <div className="text-xs text-gray-500">ID: {borrowing.book_copies.legacy_book_id}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-700">{formatDate(borrowing.borrowed_date)}</td>
                      <td className="py-3 px-4 text-gray-700">{formatDate(borrowing.due_date)}</td>
                      <td className="py-3 px-4 text-gray-700">
                        {borrowing.returned_date ? formatDate(borrowing.returned_date) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={getBorrowingStatusColor(borrowing)}>
                          {getBorrowingStatus(borrowing)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
