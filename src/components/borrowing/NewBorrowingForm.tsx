import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BookOpen, User, Calendar, AlertCircle, Search, Users, GraduationCap, Plus, Trash2 } from 'lucide-react';
import { useBooks } from '@/hooks/useBooks';
import { useBorrowingSettings } from '@/hooks/useBorrowingSettings';
import { addDays, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

interface BorrowingItem {
  id: string;
  tracking_code: string;
  copy_data?: any;
  condition_at_issue: string;
  notes: string;
}

interface NewBorrowingFormProps {
  onSubmit: (borrowings: any[]) => void;
  onCancel: () => void;
}

export const NewBorrowingForm: React.FC<NewBorrowingFormProps> = ({
  onSubmit,
  onCancel
}) => {
  const { data: books } = useBooks();
  const { calculateDueDate, getBorrowingPeriodDays, borrowingPeriodDays } = useBorrowingSettings();
  
  const [borrowerType, setBorrowerType] = useState<'student' | 'staff'>('student');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedBorrower, setSelectedBorrower] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [borrowedDate, setBorrowedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState(calculateDueDate());
  const [borrowingItems, setBorrowingItems] = useState<BorrowingItem[]>([
    {
      id: '1',
      tracking_code: '',
      condition_at_issue: 'good',
      notes: ''
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

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
            .select('id, first_name, last_name, admission_number, class_grade')
            .or(`admission_number.ilike.%${debouncedSearchQuery}%,first_name.ilike.%${debouncedSearchQuery}%,last_name.ilike.%${debouncedSearchQuery}%`)
            .eq('status', 'active')
            .order('admission_number')
            .limit(20);
          
          if (!error) {
            setSearchResults(data || []);
          }
        } else {
          const { data, error } = await supabase
            .from('staff')
            .select('id, first_name, last_name, staff_id, department')
            .or(`staff_id.ilike.%${debouncedSearchQuery}%,first_name.ilike.%${debouncedSearchQuery}%,last_name.ilike.%${debouncedSearchQuery}%`)
            .eq('status', 'active')
            .order('staff_id')
            .limit(20);
          
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

  // State to track if due date was manually changed
  const [isDueDateModified, setIsDueDateModified] = useState(false);

  // Auto-update due date when borrowed date changes (only if due date wasn't manually modified)
  const handleBorrowedDateChange = (date: string) => {
    setBorrowedDate(date);
    if (!isDueDateModified) {
      const newDueDate = calculateDueDate(new Date(date));
      setDueDate(newDueDate);
    }
  };

  // Update due date when the borrowing period changes or when the form is first loaded
  useEffect(() => {
    if (!isDueDateModified) {
      const newDueDate = calculateDueDate(new Date(borrowedDate));
      setDueDate(newDueDate);
    }
  }, [borrowingPeriodDays, borrowedDate, isDueDateModified, calculateDueDate]);

  const validateTrackingCode = async (trackingCode: string) => {
    console.log('Validating tracking code:', trackingCode);
    try {
      // First try to search by tracking code
      let { data: copyData, error } = await supabase
        .from('book_copies')
        .select(`
          id,
          book_id,
          copy_number,
          tracking_code,
          status,
          condition,
          legacy_book_id,
          books (
            id,
            title,
            author,
            book_code
          )
        `)
        .eq('tracking_code', trackingCode.trim())
        .single();

      console.log('Search by tracking code result:', { copyData, error });

      // If not found by tracking code, try legacy book ID if the input is numeric
      if (!copyData && !isNaN(parseInt(trackingCode.trim()))) {
        const legacyBookId = parseInt(trackingCode.trim());
        console.log('Searching by legacy book ID:', legacyBookId);
        
        const legacyResult = await supabase
          .from('book_copies')
          .select(`
            id,
            book_id,
            copy_number,
            tracking_code,
            status,
            condition,
            legacy_book_id,
            books (
              id,
              title,
              author,
              book_code
            )
          `)
          .eq('legacy_book_id', legacyBookId)
          .single();
        
        console.log('Search by legacy book ID result:', legacyResult);
        copyData = legacyResult.data;
        error = legacyResult.error;
      }

      if (error || !copyData) {
        console.log('No book copy found');
        return null;
      }

      if (copyData.status !== 'available') {
        console.log('Book copy not available, status:', copyData.status);
        return null;
      }

      console.log('Found valid book copy:', copyData);
      return copyData;
    } catch (error) {
      console.error('Error validating tracking code:', error);
      return null;
    }
  };

  const handleTrackingCodeChange = async (id: string, trackingCode: string) => {
    // Update the tracking code immediately
    setBorrowingItems(prevItems => 
      prevItems.map(item =>
        item.id === id
          ? { ...item, tracking_code: trackingCode, copy_data: undefined }
          : item
      )
    );

    // If tracking code is valid format, validate it
    if (trackingCode.trim().length >= 3) {
      const copyData = await validateTrackingCode(trackingCode);
      if (copyData) {
        setBorrowingItems(prevItems => 
          prevItems.map(item =>
            item.id === id
              ? { ...item, copy_data: copyData }
              : item
          )
        );
      }
    }
  };

  const addBorrowingItem = () => {
    const newItem: BorrowingItem = {
      id: Date.now().toString(),
      tracking_code: '',
      condition_at_issue: 'good',
      notes: ''
    };
    setBorrowingItems(prevItems => [...prevItems, newItem]);
  };

  const removeBorrowingItem = (id: string) => {
    if (borrowingItems.length > 1) {
      setBorrowingItems(prevItems => prevItems.filter(item => item.id !== id));
    }
  };

  const updateBorrowingItem = (id: string, field: keyof BorrowingItem, value: any) => {
    setBorrowingItems(items =>
      items.map(item =>
        item.id === id
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) {
      return;
    }

    if (!selectedBorrower) {
      alert(`Please select a ${borrowerType}.`);
      return;
    }

    // Validate dates
    if (!borrowedDate || !dueDate) {
      alert('Please ensure both issue date and due date are set.');
      return;
    }

    if (new Date(dueDate) <= new Date(borrowedDate)) {
      alert('Due date must be after the issue date.');
      return;
    }

    // Filter valid items
    const validItems = borrowingItems.filter(item => 
      item.tracking_code.trim() && item.copy_data && item.copy_data.id
    );

    if (validItems.length === 0) {
      alert('Please add at least one valid book with a tracking code.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare borrowing records
      const borrowingRecords = validItems.map(item => ({
        student_id: borrowerType === 'student' ? selectedBorrower.id : null,
        staff_id: borrowerType === 'staff' ? selectedBorrower.id : null,
        borrower_type: borrowerType,
        book_id: item.copy_data.book_id,
        book_copy_id: item.copy_data.id,
        tracking_code: item.tracking_code,
        borrowed_date: borrowedDate,
        due_date: dueDate,
        condition_at_issue: item.condition_at_issue,
        notes: item.notes.trim() || null,
        status: 'active'
      }));

      await onSubmit(borrowingRecords);
    } catch (error) {
      console.error('Error submitting borrowing:', error);
      alert('Failed to issue books. Please try again.');
      setIsSubmitting(false);
    }
  };

  const canSubmit = selectedBorrower && 
                   borrowedDate && 
                   dueDate &&
                   !isSubmitting &&
                   borrowingItems.some(item => item.tracking_code.trim() && item.copy_data);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Searching...
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

      {/* Borrowing Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Borrowing Details
          </CardTitle>
        </CardHeader>
        <CardContent>
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
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  Standard borrowing period: <span className="font-medium">{getBorrowingPeriodDays()} days</span>
                </span>
                {isDueDateModified && (
                  <Button 
                    type="button" 
                    variant="link" 
                    size="sm" 
                    className="h-4 p-0 text-xs"
                    onClick={() => {
                      const newDueDate = calculateDueDate(new Date(borrowedDate));
                      setDueDate(newDueDate);
                      setIsDueDateModified(false);
                    }}
                  >
                    Reset to standard
                  </Button>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="due_date">Due Date *</Label>
              <Input
                id="due_date"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  if (!isDueDateModified) {
                    setIsDueDateModified(true);
                  }
                }}
                min={borrowedDate}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Books to Issue */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Books to Issue
          </CardTitle>
          <Button
            type="button"
            onClick={addBorrowingItem}
            variant="outline"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Book
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {borrowingItems.map((item, index) => (
              <div key={item.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Book {index + 1}</h3>
                  {borrowingItems.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => removeBorrowingItem(item.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor={`tracking-code-${item.id}`}>Book Tracking Code *</Label>
                    <Input
                      id={`tracking-code-${item.id}`}
                      placeholder="Enter tracking code (e.g., ACC/001/24)"
                      value={item.tracking_code}
                      onChange={(e) => handleTrackingCodeChange(item.id, e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  
                  {item.copy_data && (
                    <div className="bg-green-50 p-3 rounded-md">
                      <h4 className="font-medium text-green-800 mb-2">✓ Book Found</h4>
                      <p className="text-sm"><span className="font-medium">Title:</span> {item.copy_data.books?.title}</p>
                      <p className="text-sm"><span className="font-medium">Author:</span> {item.copy_data.books?.author}</p>
                      <p className="text-sm"><span className="font-medium">Status:</span> {item.copy_data.status}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`condition-${item.id}`}>Condition at Issue</Label>
                      <Select
                        value={item.condition_at_issue}
                        onValueChange={(value) => updateBorrowingItem(item.id, 'condition_at_issue', value)}
                      >
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
                      <Label htmlFor={`notes-${item.id}`}>Notes (Optional)</Label>
                      <Input
                        id={`notes-${item.id}`}
                        placeholder="Any notes about this book copy"
                        value={item.notes}
                        onChange={(e) => updateBorrowingItem(item.id, 'notes', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
            'Issue Books'
          )}
        </Button>
      </div>
    </form>
  );
};