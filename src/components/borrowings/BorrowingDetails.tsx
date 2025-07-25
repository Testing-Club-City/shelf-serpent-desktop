import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, BookOpen, Calendar, User, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { BookReturnForm } from '@/components/borrowing/BookReturnForm';
import { useStudents } from '@/hooks/useStudents';
import { useBooks } from '@/hooks/useBooks';
import { useProfile } from '@/hooks/useProfile';

interface BorrowingDetailsProps {
  borrowing: any;
  onBack: () => void;
  onUpdate?: () => void;
}

export const BorrowingDetails = ({ borrowing, onBack, onUpdate }: BorrowingDetailsProps) => {
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const { data: studentsResponse } = useStudents();
  const { data: books } = useBooks();
  
  // Extract students array safely
  const students = Array.isArray(studentsResponse?.students) ? studentsResponse.students : [];
  const { data: profile } = useProfile();

  const student = students?.find(s => s.id === borrowing.student_id);
  const book = books?.find(b => b.id === borrowing.book_id);
  
  // Safe date formatting function
  const formatSafeDate = (dateValue: any, formatString: string = 'MMM dd, yyyy') => {
    if (!dateValue) return '—';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '—';
      return format(date, formatString);
    } catch {
      return '—';
    }
  };
  
  // Safe overdue calculation
  const isOverdue = (() => {
    if (borrowing.status !== 'active' || !borrowing.due_date) return false;
    try {
      const dueDate = new Date(borrowing.due_date);
      if (isNaN(dueDate.getTime())) return false;
      return dueDate < new Date();
    } catch {
      return false;
    }
  })();
  
  const daysDue = (() => {
    if (!isOverdue || !borrowing.due_date) return 0;
    try {
      const dueDate = new Date(borrowing.due_date);
      if (isNaN(dueDate.getTime())) return 0;
      return Math.ceil((new Date().getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
    } catch {
      return 0;
    }
  })();

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return isOverdue ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
      case 'returned':
        return 'bg-blue-100 text-blue-800';
      case 'lost':
        return 'bg-orange-100 text-orange-800';
      case 'damaged':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return isOverdue ? <AlertTriangle className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />;
      case 'returned':
        return <CheckCircle className="h-4 w-4" />;
      case 'lost':
        return <AlertTriangle className="h-4 w-4" />;
      case 'damaged':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  const handleReturnSuccess = (data: any) => {
    setShowReturnDialog(false);
    onUpdate?.();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Borrowing Details</h1>
          <p className="text-gray-600">Complete borrowing information and actions</p>
        </div>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon(borrowing.status)}
            Current Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge className={getStatusColor(borrowing.status)}>
              {borrowing.status?.toUpperCase()}
            </Badge>
            {isOverdue && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {daysDue} days overdue
              </Badge>
            )}
            {borrowing.tracking_code && (
              <Badge variant="outline" className="font-mono">
                #{borrowing.tracking_code}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Student Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Student Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Name</label>
              <p className="text-lg font-semibold">
                {student ? `${student.first_name} ${student.last_name}` : 'Unknown Student'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Admission Number</label>
              <p className="font-mono">{student?.admission_number || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Class</label>
              <p>{student?.class_grade || 'N/A'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Book Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Book Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Title</label>
              <p className="text-lg font-semibold">{book?.title || 'Unknown Book'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Author</label>
              <p>{book?.author || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Book Code</label>
              <p className="font-mono">{book?.book_code || 'N/A'}</p>
            </div>
            {book?.isbn && (
              <div>
                <label className="text-sm font-medium text-gray-500">ISBN</label>
                <p className="font-mono">{book.isbn}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Borrowing Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Borrowing Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {formatSafeDate(borrowing.issue_date || borrowing.created_at, 'MMM dd')}
              </div>
              <div className="text-sm text-gray-500">Issue Date</div>
              <div className="text-xs text-gray-400 mt-1">
                {formatSafeDate(borrowing.issue_date || borrowing.created_at, 'yyyy')}
              </div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className={`text-2xl font-bold ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                {formatSafeDate(borrowing.due_date, 'MMM dd')}
              </div>
              <div className="text-sm text-gray-500">Due Date</div>
              <div className="text-xs text-gray-400 mt-1">
                {formatSafeDate(borrowing.due_date, 'yyyy')}
              </div>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-gray-600">
                {formatSafeDate(borrowing.return_date, 'MMM dd')}
              </div>
              <div className="text-sm text-gray-500">Return Date</div>
              <div className="text-xs text-gray-400 mt-1">
                {borrowing.return_date ? formatSafeDate(borrowing.return_date, 'yyyy') : 'Not returned'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Condition & Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Condition & Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Condition at Issue</label>
              <p className="capitalize">{borrowing.condition_at_issue || 'Not recorded'}</p>
            </div>
            {borrowing.condition_at_return && (
              <div>
                <label className="text-sm font-medium text-gray-500">Condition at Return</label>
                <p className="capitalize">{borrowing.condition_at_return}</p>
              </div>
            )}
          </div>
          
          {borrowing.notes && (
            <div>
              <label className="text-sm font-medium text-gray-500">Issue Notes</label>
              <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{borrowing.notes}</p>
            </div>
          )}
          
          {borrowing.return_notes && (
            <div>
              <label className="text-sm font-medium text-gray-500">Return Notes</label>
              <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{borrowing.return_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Librarian Information */}
      <Card>
        <CardHeader>
          <CardTitle>Librarian Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Issued By</label>
            <p>{borrowing.issued_by_name || 'System'}</p>
            <p className="text-xs text-gray-400">
              {formatSafeDate(borrowing.created_at, 'PPP p')}
            </p>
          </div>
          
          {borrowing.returned_by_name && (
            <div>
              <label className="text-sm font-medium text-gray-500">Returned To</label>
              <p>{borrowing.returned_by_name}</p>
              {borrowing.return_date && (
                <p className="text-xs text-gray-400">
                  {formatSafeDate(borrowing.return_date, 'PPP p')}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {borrowing.status === 'active' && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                onClick={() => setShowReturnDialog(true)}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Process Return
              </Button>
              
              {isOverdue && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Overdue - Follow up required
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Return Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Process Book Return</DialogTitle>
          </DialogHeader>
          <BookReturnForm
            initialBorrowing={borrowing}
            onSubmit={handleReturnSuccess}
            onCancel={() => setShowReturnDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
