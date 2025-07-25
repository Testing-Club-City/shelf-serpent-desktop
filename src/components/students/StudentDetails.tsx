
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Calendar, User } from 'lucide-react';
import { useBorrowings } from '@/hooks/useBorrowings';

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
  const { data: borrowings } = useBorrowings();
  
  // Filter borrowings for this student
  const studentBorrowings = (borrowings?.data || []).filter(b => b.student_id === student.id);
  const activeBorrowings = studentBorrowings.filter(b => b.status === 'active');
  const overdueBorrowings = studentBorrowings.filter(b => {
    if (b.status !== 'active') return false;
    const dueDate = new Date(b.due_date);
    return dueDate < new Date();
  });

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
    const dueDate = new Date(borrowing.due_date);
    if (dueDate < new Date()) return 'bg-red-100 text-red-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getBorrowingStatus = (borrowing: any) => {
    if (borrowing.status === 'returned') return 'Returned';
    const dueDate = new Date(borrowing.due_date);
    if (dueDate < new Date()) return 'Overdue';
    return 'Active';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Students
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Student Details</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Information */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Student Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Full Name</label>
                <p className="text-lg font-semibold">{student.first_name} {student.last_name}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Admission Number</label>
                <p className="font-medium">{student.admission_number}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Class</label>
                <p className="font-medium">{student.class_grade}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <Badge className={getStatusColor(student.status || 'active')}>
                  {student.status || 'Active'}
                </Badge>
              </div>

              {student.enrollment_date && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Enrollment Date</label>
                  <p className="font-medium">{new Date(student.enrollment_date).toLocaleDateString()}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Borrowing Statistics */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Borrowings</p>
                    <p className="text-3xl font-bold text-gray-900">{studentBorrowings.length}</p>
                  </div>
                  <BookOpen className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Borrowings</p>
                    <p className="text-3xl font-bold text-blue-600">{activeBorrowings.length}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Overdue Books</p>
                    <p className="text-3xl font-bold text-red-600">{overdueBorrowings.length}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Borrowing History */}
          <Card>
            <CardHeader>
              <CardTitle>Borrowing History</CardTitle>
            </CardHeader>
            <CardContent>
              {studentBorrowings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Book</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Book Copy</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Borrow Date</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Due Date</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Return Date</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentBorrowings.map((borrowing) => (
                        <tr key={borrowing.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-medium text-gray-900">{borrowing.books?.title}</div>
                              <div className="text-sm text-gray-600">{borrowing.books?.author}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {borrowing.book_copies ? (
                              <div className="space-y-1">
                                <div className="font-medium text-sm">
                                  Copy #{borrowing.book_copies.copy_number}
                                </div>
                                {borrowing.book_copies.tracking_code && (
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {borrowing.book_copies.tracking_code}
                                  </Badge>
                                )}
                              </div>
                            ) : borrowing.tracking_code ? (
                              <div className="space-y-1">
                                <div className="text-sm text-gray-600">
                                  General borrowing
                                </div>
                                <Badge variant="outline" className="text-xs font-mono bg-gray-50">
                                  {borrowing.tracking_code}
                                </Badge>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">
                                <div>Legacy borrowing</div>
                                <div className="text-xs">No copy tracking</div>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-700">{borrowing.borrowed_date}</td>
                          <td className="py-3 px-4 text-gray-700">{borrowing.due_date}</td>
                          <td className="py-3 px-4 text-gray-700">
                            {borrowing.returned_date || '-'}
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
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No borrowing history found for this student.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
