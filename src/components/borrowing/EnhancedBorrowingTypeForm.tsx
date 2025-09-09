import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BookOpen, User, Calendar, Clock, Search, Users, Plus } from 'lucide-react';
import { useBooks } from '@/hooks/useBooks';
import { format, addDays, addYears, addMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

interface EnhancedBorrowingTypeFormProps {
  onSubmit: (borrowing: any) => void;
  onCancel: () => void;
  preselectedCopy?: any;
}

export const EnhancedBorrowingTypeForm: React.FC<EnhancedBorrowingTypeFormProps> = ({
  onSubmit,
  onCancel,
  preselectedCopy
}) => {
  const { data: books } = useBooks();
  
  const [borrowingType, setBorrowingType] = useState<'short_term' | 'long_term'>('short_term');
  const [borrowerType, setBorrowerType] = useState<'student' | 'staff'>('student');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedBorrower, setSelectedBorrower] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBook, setSelectedBook] = useState('');
  const [borrowedDate, setBorrowedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState('');
  const [borrowingPeriod, setBorrowingPeriod] = useState('2_weeks');
  const [conditionAtIssue, setConditionAtIssue] = useState('good');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Auto-select book if preselected copy is provided
  useEffect(() => {
    if (preselectedCopy) {
      setSelectedBook(preselectedCopy.book_id);
      setConditionAtIssue(preselectedCopy.condition || 'good');
    }
  }, [preselectedCopy]);

  // Calculate due date based on borrowing type and period
  useEffect(() => {
    const calculateDueDate = () => {
      const startDate = new Date(borrowedDate);
      
      if (borrowingType === 'short_term') {
        switch (borrowingPeriod) {
          case '1_week':
            return format(addDays(startDate, 7), 'yyyy-MM-dd');
          case '2_weeks':
            return format(addDays(startDate, 14), 'yyyy-MM-dd');
          case '3_weeks':
            return format(addDays(startDate, 21), 'yyyy-MM-dd');
          case '1_month':
            return format(addMonths(startDate, 1), 'yyyy-MM-dd');
          case '1_term':
            return format(addMonths(startDate, 3), 'yyyy-MM-dd');
          default:
            return format(addDays(startDate, 14), 'yyyy-MM-dd');
        }
      } else {
        switch (borrowingPeriod) {
          case '1_year':
            return format(addYears(startDate, 1), 'yyyy-MM-dd');
          case '2_years':
            return format(addYears(startDate, 2), 'yyyy-MM-dd');
          case '3_years':
            return format(addYears(startDate, 3), 'yyyy-MM-dd');
          case '4_years':
            return format(addYears(startDate, 4), 'yyyy-MM-dd');
          default:
            return format(addYears(startDate, 1), 'yyyy-MM-dd');
        }
      }
    };

    setDueDate(calculateDueDate());
  }, [borrowedDate, borrowingType, borrowingPeriod]);

  // Reset period when borrowing type changes
  useEffect(() => {
    if (borrowingType === 'short_term') {
      setBorrowingPeriod('2_weeks');
    } else {
      setBorrowingPeriod('1_year');
    }
  }, [borrowingType]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;

    if (!selectedBorrower) {
      alert('Please select a borrower.');
      return;
    }

    if (borrowerType === 'student' && selectedBorrower.status !== 'active') {
      alert(`Cannot issue book to ${selectedBorrower.first_name} ${selectedBorrower.last_name}. Student is ${selectedBorrower.status} and cannot borrow books.`);
      return;
    }

    if (!borrowedDate || !dueDate) {
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
        book_id: preselectedCopy?.book_id,
        book_copy_id: preselectedCopy?.id || null,
        tracking_code: preselectedCopy?.tracking_code || null,
        borrowed_date: borrowedDate,
        due_date: dueDate,
        borrowing_type: borrowingType,
        borrowing_period: borrowingPeriod,
        condition_at_issue: conditionAtIssue,
        notes: notes.trim() || null,
        status: 'active'
      };

      await onSubmit(borrowing);
      
    } catch (error) {
      console.error('Error submitting borrowing:', error);
      alert('Failed to issue book. Please try again.');
      setIsSubmitting(false);
    }
  };

  const availableBooks = books?.filter(book => book.available_copies > 0) || [];

  const canSubmit = selectedBorrower && 
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

      {/* Borrowing Type Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Borrowing Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="borrowing-type">Borrowing Type *</Label>
              <Select value={borrowingType} onValueChange={(value: 'short_term' | 'long_term') => setBorrowingType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short_term">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Short Term (Weeks)
                    </div>
                  </SelectItem>
                  <SelectItem value="long_term">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Long Term (Years/Terms)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="borrowing-period">
                {borrowingType === 'short_term' ? 'Borrowing Period (Weeks)' : 'Borrowing Period (Long Term)'} *
              </Label>
              <Select value={borrowingPeriod} onValueChange={setBorrowingPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {borrowingType === 'short_term' ? (
                    <>
                      <SelectItem value="1_week">1 Week (7 days)</SelectItem>
                      <SelectItem value="2_weeks">2 Weeks (14 days)</SelectItem>
                      <SelectItem value="3_weeks">3 Weeks (21 days)</SelectItem>
                      <SelectItem value="1_month">1 Month</SelectItem>
                      <SelectItem value="1_term">1 Term</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="1_year">1 Year</SelectItem>
                      <SelectItem value="2_years">2 Years</SelectItem>
                      <SelectItem value="3_years">3 Years</SelectItem>
                      <SelectItem value="4_years">4 Years</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {borrowingType === 'short_term' 
                  ? 'Standard borrowing with 14 days period and fine system'
                  : 'Long-term borrowings have no fine penalties and no book limits'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                <SelectContent>
                  <SelectItem value="student">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Student
                    </div>
                  </SelectItem>
                  <SelectItem value="staff">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Staff
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="borrower-search">
                Search {borrowerType === 'student' ? 'Student' : 'Staff'} *
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
                  <Users className="h-4 w-4 text-green-600" />
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



      {/* Books to Issue */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />
            Books to Issue
          </CardTitle>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            className="ml-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Book
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3">Book 1</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tracking_code">Book Tracking Code *</Label>
                  <Input
                    id="tracking_code"
                    placeholder="Enter tracking code (e.g., ACC/001/24)"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="condition">Condition at Issue</Label>
                  <Select defaultValue="good">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                      <SelectItem value="damaged">Damaged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <Label htmlFor="book_notes">Notes (Optional)</Label>
                <Textarea
                  id="book_notes"
                  placeholder="Any notes about this book copy"
                  rows={2}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
                  onChange={(e) => setBorrowedDate(e.target.value)}
                  required
                />
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
                <p className="text-xs text-gray-500 mt-1">
                  {borrowingType === 'long_term' ? 'No fines for overdue long-term borrowings' : 'Standard fine rules apply'}
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="condition_at_issue">Condition at Issue</Label>
              <Select value={conditionAtIssue} onValueChange={setConditionAtIssue}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
            `Issue Book (${borrowingType === 'short_term' ? 'Short Term' : 'Long Term'})`
          )}
        </Button>
      </div>
    </form>
  );
};