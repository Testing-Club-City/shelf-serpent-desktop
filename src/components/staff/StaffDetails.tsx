import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Phone, Mail, Building, Briefcase, Calendar, BookOpen, AlertTriangle } from 'lucide-react';
import { Staff } from '@/hooks/useStaff';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';

interface StaffDetailsProps {
  staff: Staff;
  onBack: () => void;
}

export const StaffDetails: React.FC<StaffDetailsProps> = ({ staff, onBack }) => {
  // Get staff borrowing history
  const { data: borrowings } = useQuery({
    queryKey: ['staff-borrowings', staff.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('borrowings')
        .select(`
          *,
          books (
            id,
            title,
            author
          )
        `)
        .eq('staff_id', staff.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Get staff fines
  const { data: fines } = useQuery({
    queryKey: ['staff-fines', staff.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fines')
        .select(`
          *,
          borrowings (
            id,
            tracking_code,
            books (
              title,
              author
            )
          )
        `)
        .eq('staff_id', staff.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const activeBorrowings = borrowings?.filter(b => b.status === 'active') || [];
  const returnedBorrowings = borrowings?.filter(b => b.status === 'returned') || [];
  const overdueBorrowings = borrowings?.filter(b => {
    if (b.status !== 'active') return false;
    const dueDate = new Date(b.due_date);
    return dueDate < new Date();
  }) || [];

  const unpaidFines = fines?.filter(f => f.status === 'unpaid') || [];
  const totalUnpaidAmount = unpaidFines.reduce((sum, fine) => sum + (fine.amount || 0), 0);

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

  const getBorrowingStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'returned':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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
            Back to Staff List
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {staff.first_name} {staff.last_name}
            </h1>
            <p className="text-gray-600">TSC Number: {staff.staff_id}</p>
          </div>
        </div>
        <Badge className={getStatusColor(staff.status)}>
          {staff.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Staff Information */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Staff Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">First Name</label>
                  <p className="text-gray-900">{staff.first_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Name</label>
                  <p className="text-gray-900">{staff.last_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">TSC Number</label>
                  <p className="text-gray-900">{staff.staff_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <Badge className={getStatusColor(staff.status)}>
                    {staff.status}
                  </Badge>
                </div>
              </div>
              
              {staff.email && (
                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </label>
                  <p className="text-gray-900">{staff.email}</p>
                </div>
              )}
              
              {staff.phone && (
                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone
                  </label>
                  <p className="text-gray-900">{staff.phone}</p>
                </div>
              )}
              
              {staff.department && (
                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Department
                  </label>
                  <p className="text-gray-900">{staff.department}</p>
                </div>
              )}
              
              {staff.position && (
                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Position
                  </label>
                  <p className="text-gray-900">{staff.position}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Member Since
                </label>
                <p className="text-gray-900">{formatDate(staff.created_at)}</p>
              </div>
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
                <span className="text-sm text-gray-600">Active Borrowings</span>
                <span className="font-semibold text-blue-600">{activeBorrowings.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Overdue Books</span>
                <span className="font-semibold text-red-600">{overdueBorrowings.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Borrowings</span>
                <span className="font-semibold">{borrowings?.length || 0}</span>
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
                    {formatCurrency(totalUnpaidAmount)}
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

      {/* Active Borrowings */}
      {activeBorrowings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Borrowings ({activeBorrowings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Book</th>
                    <th className="text-left py-2">Borrowed Date</th>
                    <th className="text-left py-2">Due Date</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBorrowings.map((borrowing) => {
                    const isOverdue = new Date(borrowing.due_date) < new Date();
                    return (
                      <tr key={borrowing.id} className="border-b">
                        <td className="py-2">
                          <div>
                            <p className="font-medium">{borrowing.books?.title}</p>
                            <p className="text-sm text-gray-600">by {borrowing.books?.author}</p>
                          </div>
                        </td>
                        <td className="py-2">{formatDate(borrowing.borrowed_date || borrowing.created_at)}</td>
                        <td className="py-2">{formatDate(borrowing.due_date)}</td>
                        <td className="py-2">
                          <Badge className={getBorrowingStatusColor(isOverdue ? 'overdue' : 'active')}>
                            {isOverdue ? 'Overdue' : 'Active'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Borrowing History */}
      {returnedBorrowings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Returns ({returnedBorrowings.slice(0, 10).length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Book</th>
                    <th className="text-left py-2">Borrowed Date</th>
                    <th className="text-left py-2">Returned Date</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {returnedBorrowings.slice(0, 10).map((borrowing) => (
                    <tr key={borrowing.id} className="border-b">
                      <td className="py-2">
                        <div>
                          <p className="font-medium">{borrowing.books?.title}</p>
                          <p className="text-sm text-gray-600">by {borrowing.books?.author}</p>
                        </div>
                      </td>
                      <td className="py-2">{formatDate(borrowing.borrowed_date || borrowing.created_at)}</td>
                      <td className="py-2">{borrowing.returned_date ? formatDate(borrowing.returned_date) : 'N/A'}</td>
                      <td className="py-2">
                        <Badge className={getBorrowingStatusColor(borrowing.status)}>
                          {borrowing.status}
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

      {/* Outstanding Fines Details */}
      {unpaidFines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Outstanding Fines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">Amount</th>
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidFines.map((fine) => (
                    <tr key={fine.id} className="border-b">
                      <td className="py-2">
                        <Badge variant="outline">
                          {fine.fine_type.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2 font-semibold text-red-600">
                        {formatCurrency(fine.amount)}
                      </td>
                      <td className="py-2">{formatDate(fine.created_at)}</td>
                      <td className="py-2">{fine.description || 'N/A'}</td>
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