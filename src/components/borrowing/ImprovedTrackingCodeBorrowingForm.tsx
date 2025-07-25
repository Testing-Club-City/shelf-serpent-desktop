
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Plus, Trash2, ArrowLeft, BookOpen, User } from 'lucide-react';
import { StudentSelector } from './StudentSelector';
import { EnhancedBookCopySelector } from './EnhancedBookCopySelector';
import { useCreateBorrowing } from '@/hooks/useBorrowings';
import { addDays, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface BorrowingFormData {
  id: string;
  student: any;
  bookCopy: {
    tracking_code: string;
    copy_data?: any;
  };
  conditionAtIssue: string;
  notes: string;
}

interface ImprovedTrackingCodeBorrowingFormProps {
  onSubmit: (borrowings: any[]) => void;
  onCancel: () => void;
}

export const ImprovedTrackingCodeBorrowingForm: React.FC<ImprovedTrackingCodeBorrowingFormProps> = ({
  onSubmit,
  onCancel
}) => {
  const [borrowings, setBorrowings] = useState<BorrowingFormData[]>([
    {
      id: '1',
      student: null,
      bookCopy: { tracking_code: '' },
      conditionAtIssue: 'good',
      notes: ''
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const createBorrowing = useCreateBorrowing();
  const { toast } = useToast();

  const addBorrowingRow = () => {
    setBorrowings(prev => [
      ...prev,
      {
        id: String(prev.length + 1),
        student: null,
        bookCopy: { tracking_code: '' },
        conditionAtIssue: 'good',
        notes: ''
      }
    ]);
  };

  const removeBorrowingRow = (id: string) => {
    if (borrowings.length > 1) {
      setBorrowings(prev => prev.filter(b => b.id !== id));
    }
  };

  const updateBorrowing = (id: string, field: string, value: any) => {
    setBorrowings(prev => prev.map(b => 
      b.id === id ? { ...b, [field]: value } : b
    ));
  };

  const handleSubmit = async () => {
    // Validate all borrowings
    const validBorrowings = borrowings.filter(b => 
      b.student && b.bookCopy.copy_data
    );

    if (validBorrowings.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one student and book copy',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Process each borrowing
      for (const borrowing of validBorrowings) {
        const borrowingData = {
          student_id: borrowing.student.id,
          book_id: borrowing.bookCopy.copy_data.book_id,
          book_copy_id: borrowing.bookCopy.copy_data.id,
          tracking_code: borrowing.bookCopy.tracking_code,
          borrowed_date: format(new Date(), 'yyyy-MM-dd'),
          due_date: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
          condition_at_issue: borrowing.conditionAtIssue,
          notes: borrowing.notes,
          status: 'active'
        };

        await createBorrowing.mutateAsync(borrowingData);
      }

      onSubmit(validBorrowings);
    } catch (error) {
      console.error('Error creating borrowings:', error);
      toast({
        title: 'Error',
        description: 'Failed to process some borrowings. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = borrowings.some(b => b.student && b.bookCopy.copy_data);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-2xl">Issue Books</CardTitle>
                <p className="text-blue-100 mt-1">
                  Select students and books to create new borrowings
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={onCancel}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Borrowing Forms */}
      <div className="space-y-6">
        {borrowings.map((borrowing, index) => (
          <Card key={borrowing.id} className="overflow-hidden">
            <CardHeader className="bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-white">
                    Borrowing #{index + 1}
                  </Badge>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CalendarDays className="w-4 h-4" />
                    Due: {format(addDays(new Date(), 14), 'MMM dd, yyyy')}
                  </div>
                </div>
                {borrowings.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBorrowingRow(borrowing.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Student Selection */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-5 h-5 text-blue-600" />
                    <h3 className="font-medium text-gray-900">Student Selection</h3>
                  </div>
                  <StudentSelector
                    value={borrowing.student}
                    onChange={(student) => updateBorrowing(borrowing.id, 'student', student)}
                  />
                </div>

                {/* Book Copy Selection */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-5 h-5 text-green-600" />
                    <h3 className="font-medium text-gray-900">Book Copy Selection</h3>
                  </div>
                  <EnhancedBookCopySelector
                    value={borrowing.bookCopy}
                    onChange={(trackingCode, copyData) => 
                      updateBorrowing(borrowing.id, 'bookCopy', { tracking_code: trackingCode, copy_data: copyData })
                    }
                    conditionAtIssue={borrowing.conditionAtIssue}
                    onConditionChange={(condition) => updateBorrowing(borrowing.id, 'conditionAtIssue', condition)}
                    notes={borrowing.notes}
                    onNotesChange={(notes) => updateBorrowing(borrowing.id, 'notes', notes)}
                  />
                </div>
              </div>

              {/* Borrowing Summary */}
              {borrowing.student && borrowing.bookCopy.copy_data && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Borrowing Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-green-700 font-medium">Student:</span>
                      <p className="text-green-900">
                        {borrowing.student.first_name} {borrowing.student.last_name}
                      </p>
                      <p className="text-green-700">{borrowing.student.class_grade}</p>
                    </div>
                    <div>
                      <span className="text-green-700 font-medium">Book:</span>
                      <p className="text-green-900">{borrowing.bookCopy.copy_data.books?.title}</p>
                      <p className="text-green-700">{borrowing.bookCopy.tracking_code}</p>
                    </div>
                    <div>
                      <span className="text-green-700 font-medium">Condition:</span>
                      <p className="text-green-900 capitalize">{borrowing.conditionAtIssue}</p>
                      <p className="text-green-700">Due: {format(addDays(new Date(), 14), 'MMM dd')}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between bg-white p-4 border border-gray-200 rounded-lg shadow-sm">
        <Button
          variant="outline"
          onClick={addBorrowingRow}
          className="border-blue-300 text-blue-600 hover:bg-blue-50"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Another Borrowing
        </Button>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Processing...
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4 mr-2" />
                Issue Books ({borrowings.filter(b => b.student && b.bookCopy.copy_data).length})
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
