import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BookOpen, User, Calendar, AlertCircle, Search, Users, GraduationCap } from 'lucide-react';
import { useBooks } from '@/hooks/useBooks';
import { useBorrowingSettings } from '@/hooks/useBorrowingSettings';
import { addDays, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

interface BorrowingFormProps {
  onSubmit: (borrowing: any) => void;
  onCancel: () => void;
  preselectedCopy?: any;
}

export const BorrowingForm: React.FC<BorrowingFormProps> = ({
  onSubmit,
  onCancel,
  preselectedCopy
}) => {
  const { data: books } = useBooks();
  const { calculateDueDate, getBorrowingPeriodDays } = useBorrowingSettings();
  
  const [borrowerType, setBorrowerType] = useState<'student' | 'staff'>('student');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedBorrower, setSelectedBorrower] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBook, setSelectedBook] = useState('');
  const [borrowedDate, setBorrowedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState(calculateDueDate());
  const [conditionAtIssue, setConditionAtIssue] = useState('good');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Auto-select book if preselected copy is provided
  useEffect(() => {
    if (preselectedCopy) {
      setSelectedBook(preselectedCopy.book_id);
      setConditionAtIssue(preselectedCopy.condition || 'good');
    }
  }, [preselectedCopy]);

  // Search for borrowers when query changes
  useEffect(() => {
    const searchBorrowers = async () => {
      if (!debouncedSearchQuery || !debouncedSearchQuery.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        if (borrowerType === 'student') {
          const { data, error } = await supabase
            .from('students')
            .select('*')
            .or(`admission_number.ilike.%${debouncedSearchQuery}%,first_name.ilike.%${debouncedSearchQuery}%,last_name.ilike.%${debouncedSearchQuery}%`)
            .eq('status', 'active')
            .limit(10);
          
          if (!error) {
            setSearchResults(data || []);
          }
        } else {
          const { data, error } = await supabase
            .from('staff')
            .select('*')
            .or(`staff_id.ilike.%${debouncedSearchQuery}%,first_name.ilike.%${debouncedSearchQuery}%,last_name.ilike.%${debouncedSearchQuery}%`)
            .eq('status', 'active')
            .limit(10);
          
          if (!error) {
            setSearchResults(data || []);
          }
        }
      } catch (error) {
        console.error('Error searching borrowers:', error);
      } finally {
        setIsSearching(false);
      }
    };

    searchBorrowers();
  }, [debouncedSearchQuery, borrowerType]);

  // Auto-update due date when borrowed date changes
  const handleBorrowedDateChange = (date: string) => {
    setBorrowedDate(date);
    const newDueDate = calculateDueDate(new Date(date));
    setDueDate(newDueDate);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submission started');
    console.log('Selected borrower:', selectedBorrower);
    console.log('Selected book:', selectedBook);
    console.log('Preselected copy:', preselectedCopy);
    
    if (isSubmitting) {
      console.log('Already submitting, ignoring duplicate submission');
      return;
    }

    if (!selectedBorrower || !selectedBook) {
      console.error('Missing required fields:', { selectedBorrower, selectedBook });
      alert('Please select both a borrower and a book.');
      return;
    }

    // Validate book selection
    if (selectedBook === 'no-books') {
      console.error('Invalid book selection:', selectedBook);
      alert('Please select a valid book.');
      return;
    }

    // Validate dates
    if (!borrowedDate || !dueDate) {
      console.error('Missing required dates');
      alert('Please ensure both issue date and due date are set.');
      return;
    }

    if (new Date(dueDate) <= new Date(borrowedDate)) {
      alert('Due date must be after the issue date.');
      return;
    }

    setIsSubmitting(true);

    try {
      const borrowing = {
        student_id: borrowerType === 'student' ? selectedBorrower.id : null,
        staff_id: borrowerType === 'staff' ? selectedBorrower.id : null,
        borrower_type: borrowerType,
        book_id: selectedBook,
        book_copy_id: preselectedCopy?.id || null,
        tracking_code: preselectedCopy?.tracking_code || null,
        borrowed_date: borrowedDate,
        due_date: dueDate,
        condition_at_issue: conditionAtIssue,
        notes: notes.trim() || null,
        status: 'active'
      };

      console.log('Submitting borrowing:', borrowing);
      await onSubmit(borrowing);
      console.log('Borrowing submitted successfully');
      
    } catch (error) {
      console.error('Error submitting borrowing:', error);
      alert('Failed to issue book. Please try again.');
      setIsSubmitting(false);
    }
  };

  const availableBooks = books?.filter(book => book.available_copies > 0) || [];

  const canSubmit = selectedBorrower && 
                   selectedBook &&
                   selectedBook !== 'no-books' &&
                   borrowedDate && 
                   dueDate &&
                   !isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Preselected Book Info */}
      {preselectedCopy && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">
                  {preselectedCopy.books?.title}
                </p>
                <p className="text-sm text-blue-700">
                  Tracking Code: <span className="font-mono">{preselectedCopy.tracking_code}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Borrower Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Borrower Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Borrower Type Selection */}
            <div>
              <Label htmlFor="borrower-type">Borrower Type *</Label>
              <Select value={borrowerType} onValueChange={(value: 'student' | 'staff') => {
                setBorrowerType(value);
                setSelectedBorrower(null);
                setSearchQuery('');
                setSearchResults([]);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                  <SelectItem value="student">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Student
                    </div>
                  </SelectItem>
                  <SelectItem value="staff">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      Staff
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search Input */}
            <div>
              <Label htmlFor="borrower-search">
                Search {borrowerType === 'student' ? 'Student (by Admission Number or Name)' : 'Staff (by TSC Number or Name)'} *
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="borrower-search"
                  placeholder={borrowerType === 'student' ? 'Enter admission number or name...' : 'Enter staff ID or name...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Search Results */}
            {searchQuery && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {isSearching ? (
                  <div className="p-4 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto"></div>
                    <span className="ml-2">Searching...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <div
                      key={result.id}
                      className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                        selectedBorrower?.id === result.id ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                      onClick={() => {
                        setSelectedBorrower(result);
                        setSearchQuery(borrowerType === 'student' 
                          ? `${result.admission_number} - ${result.first_name} ${result.last_name}`
                          : `${result.staff_id} - ${result.first_name} ${result.last_name}`
                        );
                      }}
                    >
                      <div className="font-medium">
                        {borrowerType === 'student' 
                          ? `${result.admission_number} - ${result.first_name} ${result.last_name}`
                          : `${result.staff_id} - ${result.first_name} ${result.last_name}`
                        }
                      </div>
                      <div className="text-sm text-gray-500">
                        {borrowerType === 'student' ? result.class_grade : result.department}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No {borrowerType}s found
                  </div>
                )}
              </div>
            )}

            {/* Selected Borrower Display */}
            {selectedBorrower && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  {borrowerType === 'student' ? (
                    <Users className="h-4 w-4 text-green-600" />
                  ) : (
                    <GraduationCap className="h-4 w-4 text-green-600" />
                  )}
                  <div>
                    <div className="font-medium text-green-800">
                      {borrowerType === 'student' 
                        ? `${selectedBorrower.admission_number} - ${selectedBorrower.first_name} ${selectedBorrower.last_name}`
                        : `${selectedBorrower.staff_id} - ${selectedBorrower.first_name} ${selectedBorrower.last_name}`
                      }
                    </div>
                    <div className="text-sm text-green-600">
                      {borrowerType === 'student' ? selectedBorrower.class_grade : selectedBorrower.department}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Book Selection (only if no preselected copy) */}
      {!preselectedCopy && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              Book Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="book">Select Book *</Label>
                <Select value={selectedBook} onValueChange={setSelectedBook} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Search and select book..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-lg z-50 max-h-60 overflow-y-auto">
                    {availableBooks.length > 0 ? (
                      availableBooks.map((book) => (
                        <SelectItem key={book.id} value={book.id}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{book.title}</span>
                            <span className="text-xs text-gray-500">
                              by {book.author} • {book.available_copies} available
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-books" disabled>
                        <div className="flex items-center gap-2 text-gray-500">
                          <AlertCircle className="h-4 w-4" />
                          No available books
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Borrowing Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Borrowing Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="borrowed_date">Issue Date *</Label>
                <Input
                  id="borrowed_date"
                  type="date"
                  value={borrowedDate}
                  onChange={(e) => handleBorrowedDateChange(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Books will be due after {getBorrowingPeriodDays()} days
                </p>
              </div>
              <div>
                <Label htmlFor="due_date">Due Date *</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={borrowedDate}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="condition_at_issue">Condition at Issue</Label>
              <Select value={conditionAtIssue} onValueChange={setConditionAtIssue}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special notes about this borrowing..."
                rows={3}
                maxLength={500}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={!canSubmit}
          className="min-w-[120px]"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </>
          ) : (
            'Issue Book'
          )}
        </Button>
      </div>
    </form>
  );
};