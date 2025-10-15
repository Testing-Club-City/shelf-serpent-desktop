import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BookOpen, User, Calendar, AlertCircle, Search, Users, GraduationCap, Plus, Trash2, Ban, CheckCircle, Info } from 'lucide-react';
import { useBooksOffline } from '@/hooks/useBooksOffline';
import { useBorrowingSettings } from '@/hooks/useBorrowingSettings';
import { addDays, addMonths, addYears, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { useStudentsOffline } from '@/hooks/useStudentsOffline';
import { useStaffOffline } from '@/hooks/useStaffOffline';
import { useConnectivity } from '@/hooks/useConnectivity';
import { invoke } from '@tauri-apps/api/core';

interface BorrowingLimitCheck {
  can_borrow: boolean;
  current_borrowed: number;
  max_allowed: number;
  remaining_slots: number;
  class_name?: string;
  message: string;
}

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
  const { data: booksData } = useBooksOffline();
  const { calculateDueDate, getBorrowingPeriodDays, borrowingPeriodDays } = useBorrowingSettings();
  const connectivity = useConnectivity();

  // Use offline-first hooks for borrower data
  const { data: studentsData } = useStudentsOffline();
  const { data: staffData } = useStaffOffline();

  // Helper function to safely create current date
  const getSafeCurrentDate = () => {
    try {
      const now = new Date();
      if (isNaN(now.getTime())) {
        // Fallback to a valid date if system time is wrong
        console.warn('System date is invalid, using fallback date');
        return new Date('2024-01-01T00:00:00.000Z');
      }
      return now;
    } catch (error) {
      console.error('Error creating current date:', error);
      return new Date('2024-01-01T00:00:00.000Z');
    }
  };

  // Helper function to safely create Date objects
  const getSafeDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return getSafeCurrentDate();
      }
      return date;
    } catch (error) {
      console.error('Error creating date from string:', dateString, error);
      return getSafeCurrentDate();
    }
  };

  const [borrowerType, setBorrowerType] = useState<'student' | 'staff'>('student');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedBorrower, setSelectedBorrower] = useState<any>(null);
  const [borrowingLimit, setBorrowingLimit] = useState<BorrowingLimitCheck | null>(null);
  const [isCheckingLimit, setIsCheckingLimit] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [borrowedDate, setBorrowedDate] = useState(format(getSafeCurrentDate(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState(calculateDueDate());
  const [borrowingType, setBorrowingType] = useState<'short_term' | 'long_term'>('short_term');
  const [longTermPeriod, setLongTermPeriod] = useState('1_year');
  const [shortTermPeriod, setShortTermPeriod] = useState('2_weeks');
  const [borrowingItems, setBorrowingItems] = useState<BorrowingItem[]>([
    {
      id: '1',
      tracking_code: '',
      condition_at_issue: 'good',
      notes: ''
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keep track of active validation requests to prevent race conditions
  const [activeValidations, setActiveValidations] = useState<{ [key: string]: string }>({});
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Search for borrowers using offline-first approach
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
          // FIXED: Try offline-first using local students data
          if (studentsData && studentsData.length > 0) {
            console.log(`🔍 Searching ${studentsData.length} students from LOCAL database`);
            console.log('📊 Sample student data:', studentsData.slice(0, 2)); // Debug: Show first 2 students

            const query = debouncedSearchQuery.toLowerCase();
            console.log(`🔎 Search query: "${query}"`);

            const filteredStudents = studentsData.filter((student: any) => {
              // Debug: Log student data structure
              if (studentsData.indexOf(student) === 0) {
                console.log('🔍 Student data structure:', {
                  admission_number: student.admission_number,
                  first_name: student.first_name,
                  last_name: student.last_name,
                  status: student.status,
                  class_grade: student.class_grade
                });
              }

              // Check if student status is active (more flexible status check)
              const isActive = !student.status ||
                student.status === 'active' ||
                student.status === 'Active' ||
                student.status === 'ACTIVE';

              const matchesSearch =
                student.admission_number?.toString().toLowerCase().includes(query) ||
                student.first_name?.toLowerCase().includes(query) ||
                student.last_name?.toLowerCase().includes(query) ||
                `${student.first_name} ${student.last_name}`.toLowerCase().includes(query);

              const matches = isActive && matchesSearch;

              // Debug: Log matching logic for first few students
              if (studentsData.indexOf(student) < 3) {
                console.log(`🔍 Student ${student.admission_number}: isActive=${isActive}, matchesSearch=${matchesSearch}, finalMatch=${matches}`);
              }

              return matches;
            }).slice(0, 20); // Limit to 20 results

            console.log(`✅ Found ${filteredStudents.length} matching students from LOCAL database`);
            console.log('📋 Filtered results:', filteredStudents.slice(0, 3)); // Show first 3 results
            setSearchResults(filteredStudents || []);
          } else {
            // Fallback to Supabase if no local data available
            console.log('⚠️ No local student data available, falling back to Supabase');
            const { data, error } = await supabase
              .from('students')
              .select('id, first_name, last_name, admission_number, class_grade')
              .or(`admission_number.ilike.%${debouncedSearchQuery}%,first_name.ilike.%${debouncedSearchQuery}%,last_name.ilike.%${debouncedSearchQuery}%`)
              .eq('status', 'active')
              .order('admission_number')
              .limit(20);

            if (!error) {
              console.log(`📡 Found ${data?.length || 0} students from Supabase`);
              setSearchResults(data || []);
            } else {
              console.error('❌ Error searching students in Supabase:', error);
              setSearchResults([]);
            }
          }
        } else {
          // FIXED: Try offline-first using local staff data
          if (staffData && staffData.length > 0) {
            console.log(`🔍 Searching ${staffData.length} staff from LOCAL database`);

            const query = debouncedSearchQuery.toLowerCase();
            const filteredStaff = staffData.filter((staff: any) => {
              // Check if staff status is active (if status field exists)
              const isActive = !staff.status || staff.status === 'active';

              const matchesSearch =
                staff.staff_id?.toLowerCase().includes(query) ||
                staff.first_name?.toLowerCase().includes(query) ||
                staff.last_name?.toLowerCase().includes(query) ||
                `${staff.first_name} ${staff.last_name}`.toLowerCase().includes(query);

              return isActive && matchesSearch;
            }).slice(0, 20); // Limit to 20 results

            console.log(`✅ Found ${filteredStaff.length} matching staff from LOCAL database`);
            setSearchResults(filteredStaff || []);
          } else {
            // Fallback to Supabase if no local data available
            console.log('⚠️ No local staff data available, falling back to Supabase');
            const { data, error } = await supabase
              .from('staff')
              .select('id, first_name, last_name, staff_id, department')
              .or(`staff_id.ilike.%${debouncedSearchQuery}%,first_name.ilike.%${debouncedSearchQuery}%,last_name.ilike.%${debouncedSearchQuery}%`)
              .eq('status', 'active')
              .order('staff_id')
              .limit(20);

            if (!error) {
              console.log(`📡 Found ${data?.length || 0} staff from Supabase`);
              setSearchResults(data || []);
            } else {
              console.error('❌ Error searching staff in Supabase:', error);
              setSearchResults([]);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error searching borrowers:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    searchBorrowers();
  }, [debouncedSearchQuery, borrowerType, studentsData, staffData]);

  // Check borrowing limits when borrower is selected
  useEffect(() => {
    const checkLimit = async () => {
      if (!selectedBorrower) {
        setBorrowingLimit(null);
        return;
      }

      setIsCheckingLimit(true);
      try {
        if (borrowerType === 'student') {
          const limit = await invoke<BorrowingLimitCheck>('check_student_borrowing_limit', {
            studentId: selectedBorrower.id
          });
          setBorrowingLimit(limit);
        } else {
          const limit = await invoke<BorrowingLimitCheck>('check_staff_borrowing_limit', {
            staffId: selectedBorrower.id
          });
          setBorrowingLimit(limit);
        }
      } catch (error) {
        console.error('Error checking borrowing limit:', error);
        setBorrowingLimit(null);
      } finally {
        setIsCheckingLimit(false);
      }
    };

    checkLimit();
  }, [selectedBorrower, borrowerType, borrowingItems.length]); // Re-check when books are added/removed

  const validateTrackingCode = async (trackingCode: string) => {
    console.log('🔍 Validating tracking code:', trackingCode);
    const trimmedCode = trackingCode.trim();

    if (!trimmedCode) {
      console.log('❌ Empty tracking code');
      return null;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      let result = null;

      // Strategy 1: If numeric, try legacy_book_id search
      if (!isNaN(parseInt(trimmedCode))) {
        const legacyBookId = parseInt(trimmedCode, 10);
        console.log(`🔎 Searching for legacy_book_id: ${legacyBookId}`);
        
        try {
          result = await invoke('simple_search_book_by_legacy_id', {
            legacyBookId: legacyBookId
          });
          console.log('✅ Legacy ID search result:', JSON.stringify(result, null, 2));
        } catch (legacyError) {
          console.log('❌ Legacy ID search failed:', legacyError);
        }
      }

      // Strategy 2: If no result or not numeric, try progressive search
      if (!result) {
        console.log('🔍 Trying progressive tracking code search:', trimmedCode);
        try {
          const progressiveResult = await invoke('progressive_tracking_code_search', {
            searchTerm: trimmedCode
          });
          console.log('✅ Progressive search raw result:', JSON.stringify(progressiveResult, null, 2));
          
          if (progressiveResult && progressiveResult.search_type === 'exact' && progressiveResult.data) {
            result = progressiveResult.data;
            console.log('✅ Progressive search extracted result:', JSON.stringify(result, null, 2));
          }
        } catch (progressiveError) {
          console.log('❌ Progressive search failed:', progressiveError);
        }
      }

      console.log('🔍 Final result before validation:', JSON.stringify(result, null, 2));

      if (result && result.status === 'available') {
        console.log('✅ Book is available, formatting result');
        return {
          id: result.id,
          book_id: result.book_id || result.id,
          tracking_code: result.tracking_code || trimmedCode,
          status: result.status,
          condition: result.condition || 'good',
          legacy_book_id: result.legacy_book_id,
          books: {
            id: result.book_id || result.id,
            title: result.book_title || result.title || 'Unknown Title',
            author: result.book_author || result.author || 'Unknown Author',
            isbn: result.isbn || ''
          }
        };
      } else if (result && result.status !== 'available') {
        console.log(`❌ Book found but not available. Status: ${result.status}`);
        return null;
      } else {
        console.log('❌ Book not found in database or result is null');
        return null;
      }
    } catch (error) {
      console.log('❌ Search failed with error:', error);
      return null;
    }
  };

  const handleTrackingCodeChange = async (id: string, trackingCode: string) => {
    console.log(`🔄 Tracking code changed for ${id}: "${trackingCode}"`);

    // Update the tracking code immediately and clear any existing copy_data and errors
    setBorrowingItems(prevItems =>
      prevItems.map(item =>
        item.id === id
          ? { ...item, tracking_code: trackingCode, copy_data: undefined }
          : item
      )
    );
    
    // Clear any existing validation error for this item
    setValidationErrors(prev => {
      const { [id]: removed, ...rest } = prev;
      return rest;
    });

    // Clear any existing copy_data display immediately
    const trimmedCode = trackingCode.trim();

    // If tracking code is empty or too short, don't validate
    if (trimmedCode.length < 1) {
      console.log(`❌ Tracking code too short for ${id}: "${trimmedCode}"`);
      return;
    }

    // Create a unique request ID to track this validation
    const requestId = `${id}-${Date.now()}`;
    setActiveValidations(prev => ({ ...prev, [id]: requestId }));

    console.log(`🔍 Starting validation for ${id} with request ${requestId}: "${trimmedCode}"`);

    try {
      // Add a small delay to debounce rapid typing
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check if this request is still the latest for this item
      let shouldContinue = true;
      setActiveValidations(current => {
        if (current[id] !== requestId) {
          console.log(`🚫 Request ${requestId} cancelled - newer request exists`);
          shouldContinue = false;
        }
        return current;
      });

      if (!shouldContinue) {
        return;
      }

      const copyData = await validateTrackingCode(trimmedCode);

      // Double-check the request is still valid after async operation
      setActiveValidations(current => {
        if (current[id] !== requestId) {
          console.log(`🚫 Request ${requestId} cancelled after validation - newer request exists`);
          return current;
        }

        // Update the borrowing item with the result
        setBorrowingItems(prevItems =>
          prevItems.map(item =>
            item.id === id
              ? { ...item, copy_data: copyData }
              : item
          )
        );

        console.log(`✅ Validation completed for ${id} with request ${requestId}:`, copyData ? (copyData.books?.title || 'Unknown Title') : 'No book found');

        // Remove this request from active validations
        const { [id]: removed, ...rest } = current;
        return rest;
      });

    } catch (error) {
      console.error(`❌ Validation error for ${id} with request ${requestId}:`, error);
      
      // Store the error message for display
      setValidationErrors(prev => ({
        ...prev,
        [id]: error instanceof Error ? error.message : String(error)
      }));

      // Clean up the request
      setActiveValidations(current => {
        const { [id]: removed, ...rest } = current;
        return rest;
      });
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

    // Check borrowing limit BEFORE allowing submission
    if (borrowingLimit && borrowingItems.length > 0) {
      const totalAfterTransaction = borrowingLimit.current_borrowed + borrowingItems.length;
      if (totalAfterTransaction > borrowingLimit.max_allowed) {
        const borrowerName = `${selectedBorrower.first_name} ${selectedBorrower.last_name}`;
        const limitMessage = borrowerType === 'student' 
          ? `${borrowerName} will exceed the maximum borrowing limit!\n\nClass: ${borrowingLimit.class_name || 'N/A'}\nMaximum allowed: ${borrowingLimit.max_allowed} book(s)\nCurrently borrowed: ${borrowingLimit.current_borrowed} book(s)\nTrying to add: ${borrowingItems.length} book(s)\nTotal would be: ${totalAfterTransaction} book(s)\n\nPlease reduce the number of books or ask the student to return existing books first.`
          : `${borrowerName} will exceed the maximum borrowing limit!\n\nMaximum allowed: ${borrowingLimit.max_allowed} book(s)\nCurrently borrowed: ${borrowingLimit.current_borrowed} book(s)\nTrying to add: ${borrowingItems.length} book(s)\nTotal would be: ${totalAfterTransaction} book(s)\n\nPlease reduce the number of books.`;
        
        alert(limitMessage);
        return;
      }
    }

    // Validate dates
    if (!borrowedDate || !dueDate) {
      alert('Please ensure both issue date and due date are set.');
      return;
    }

    if (getSafeDate(dueDate) <= getSafeDate(borrowedDate)) {
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

    // Pause connectivity checks during processing to improve performance
    console.log('🔇 Pausing connectivity checks during book issuing');
    connectivity.pauseChecks();

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
        status: 'active',
        borrowing_type: borrowingType,
        long_term_period: borrowingType === 'long_term' ? longTermPeriod : null,
        short_term_period: borrowingType === 'short_term' ? shortTermPeriod : null,
        is_long_term: borrowingType === 'long_term'
      }));

      await onSubmit(borrowingRecords);
    } catch (error) {
      console.error('Error submitting borrowing:', error);
      alert('Failed to issue books. Please try again.');
    } finally {
      // Always resume connectivity checks and reset submitting state
      console.log('🔊 Resuming connectivity checks after book issuing');
      connectivity.resumeChecks();
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
                      className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${selectedBorrower?.id === result.id ? 'bg-blue-50 border-blue-200' : ''
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

            {/* Borrowing Limit Status */}
            {selectedBorrower && (
              <>
                {isCheckingLimit ? (
                  <Alert className="bg-blue-50 border-blue-200">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <AlertDescription className="text-blue-800">
                        Checking borrowing limit...
                      </AlertDescription>
                    </div>
                  </Alert>
                ) : borrowingLimit ? (
                  <Alert className={
                    borrowingLimit.can_borrow && borrowingItems.length < (borrowingLimit.remaining_slots + borrowingLimit.current_borrowed)
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }>
                    <div className="flex items-start gap-2">
                      {borrowingLimit.can_borrow && borrowingItems.length < (borrowingLimit.remaining_slots + borrowingLimit.current_borrowed) ? (
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Ban className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <AlertDescription className={
                          borrowingLimit.can_borrow && borrowingItems.length < (borrowingLimit.remaining_slots + borrowingLimit.current_borrowed)
                            ? 'text-green-800' 
                            : 'text-red-800'
                        }>
                          <div className="font-semibold mb-1">
                            {borrowingLimit.can_borrow && borrowingItems.length < (borrowingLimit.remaining_slots + borrowingLimit.current_borrowed)
                              ? 'Can Borrow Books' 
                              : 'Borrowing Limit Reached'}
                          </div>
                          <div className="text-sm space-y-1">
                            {borrowingLimit.class_name && (
                              <div>Class: <span className="font-medium">{borrowingLimit.class_name}</span></div>
                            )}
                            <div>
                              Currently Borrowed: <span className="font-medium">{borrowingLimit.current_borrowed}</span> book(s)
                            </div>
                            <div>
                              Adding in this transaction: <span className="font-medium">{borrowingItems.length}</span> book(s)
                            </div>
                            <div>
                              Total after transaction: <span className="font-medium">{borrowingLimit.current_borrowed + borrowingItems.length}</span> / <span className="font-medium">{borrowingLimit.max_allowed}</span> book(s)
                            </div>
                            {borrowingLimit.can_borrow && (borrowingLimit.remaining_slots - borrowingItems.length > 0) && (
                              <div className="text-green-700 font-medium mt-2">
                                Can add {borrowingLimit.remaining_slots - borrowingItems.length} more book(s) in this transaction
                              </div>
                            )}
                            {borrowingItems.length >= (borrowingLimit.remaining_slots + borrowingLimit.current_borrowed) && (
                              <div className="text-red-700 font-medium mt-2">
                                ⚠️ Maximum limit reached! Remove books or ask the {borrowerType} to return existing books.
                              </div>
                            )}
                          </div>
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>
                ) : null}
              </>
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
          <div className="space-y-4">
            {/* Borrowing Type Selection */}
            <div>
              <Label htmlFor="borrowing_type">Borrowing Type *</Label>
              <Select value={borrowingType} onValueChange={(value: 'short_term' | 'long_term') => {
                setBorrowingType(value);
                if (value === 'long_term') {
                  // Set due date to 1 year from issue date by default
                  const issueDate = getSafeDate(borrowedDate);
                  const longTermDue = new Date(issueDate);
                  longTermDue.setFullYear(issueDate.getFullYear() + 1);
                  setDueDate(format(longTermDue, 'yyyy-MM-dd'));
                } else {
                  // Set to 2 weeks by default for short-term
                  const issueDate = getSafeDate(borrowedDate);
                  const shortTermDue = new Date(issueDate);
                  shortTermDue.setDate(issueDate.getDate() + 14);
                  setDueDate(format(shortTermDue, 'yyyy-MM-dd'));
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                  <SelectItem value="short_term">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Short Term (Normal Borrowing)
                    </div>
                  </SelectItem>
                  <SelectItem value="long_term">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Long Term (Extended Period)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {borrowingType === 'short_term' && (
                <p className="text-xs text-gray-500 mt-1">
                  Standard borrowing with {getBorrowingPeriodDays()} days period and fine system
                </p>
              )}
              {borrowingType === 'long_term' && (
                <p className="text-xs text-blue-600 mt-1">
                  Extended borrowing with no book limits and no overdue fines
                </p>
              )}
            </div>

            {/* Short Term Period Selection */}
            {borrowingType === 'short_term' && (
              <div>
                <Label htmlFor="short_term_period">Short Term Period *</Label>
                <Select value={shortTermPeriod} onValueChange={(value) => {
                  setShortTermPeriod(value);
                  const issueDate = getSafeDate(borrowedDate);
                  const shortTermDue = new Date(issueDate);
                  
                  switch (value) {
                    case '1_week':
                      shortTermDue.setDate(issueDate.getDate() + 7);
                      break;
                    case '2_weeks':
                      shortTermDue.setDate(issueDate.getDate() + 14);
                      break;
                    case '3_weeks':
                      shortTermDue.setDate(issueDate.getDate() + 21);
                      break;
                    case '1_month':
                      shortTermDue.setMonth(issueDate.getMonth() + 1);
                      break;
                    case '1_term':
                      shortTermDue.setMonth(issueDate.getMonth() + 3);
                      break;
                  }
                  setDueDate(format(shortTermDue, 'yyyy-MM-dd'));
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                    <SelectItem value="1_week">1 Week (7 days)</SelectItem>
                    <SelectItem value="2_weeks">2 Weeks (14 days)</SelectItem>
                    <SelectItem value="3_weeks">3 Weeks (21 days)</SelectItem>
                    <SelectItem value="1_month">1 Month  (30 days) </SelectItem>
                    <SelectItem value="1_term">1 Term (3 months)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Long Term Period Selection */}
            {borrowingType === 'long_term' && (
              <div>
                <Label htmlFor="long_term_period">Long Term Period *</Label>
                <Select value={longTermPeriod} onValueChange={(value) => {
                  setLongTermPeriod(value);
                  const issueDate = getSafeDate(borrowedDate);
                  const longTermDue = new Date(issueDate);
                  
                  switch (value) {
                    case '1_year':
                      longTermDue.setFullYear(issueDate.getFullYear() + 1);
                      break;
                    case '2_years':
                      longTermDue.setFullYear(issueDate.getFullYear() + 2);
                      break;
                    case '3_years':
                      longTermDue.setFullYear(issueDate.getFullYear() + 3);
                      break;
                    case '4_years':
                      longTermDue.setFullYear(issueDate.getFullYear() + 4);
                      break;
                  }
                  setDueDate(format(longTermDue, 'yyyy-MM-dd'));
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                    <SelectItem value="1_year">1 Year (12 months)</SelectItem>
                    <SelectItem value="2_years">2 Years (24 months)</SelectItem>
                    <SelectItem value="3_years">3 Years (36 months)</SelectItem>
                    <SelectItem value="4_years">4 Years (48 months)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="borrowed_date">Issue Date *</Label>
                <Input
                  id="borrowed_date"
                  type="date"
                  value={borrowedDate}
                  onChange={(e) => {
                    setBorrowedDate(e.target.value);
                    // Auto-update due date based on borrowing type
                    if (borrowingType === 'short_term') {
                      const issueDate = getSafeDate(e.target.value);
                      const shortTermDue = new Date(issueDate);
                      switch (shortTermPeriod) {
                        case '1_week':
                          shortTermDue.setDate(issueDate.getDate() + 7);
                          break;
                        case '2_weeks':
                          shortTermDue.setDate(issueDate.getDate() + 14);
                          break;
                        case '3_weeks':
                          shortTermDue.setDate(issueDate.getDate() + 21);
                          break;
                        case '1_month':
                          shortTermDue.setMonth(issueDate.getMonth() + 1);
                          break;
                        case '1_term':
                          shortTermDue.setMonth(issueDate.getMonth() + 3);
                          break;
                      }
                      setDueDate(format(shortTermDue, 'yyyy-MM-dd'));
                    } else {
                      const issueDate = getSafeDate(e.target.value);
                      const longTermDue = new Date(issueDate);
                      switch (longTermPeriod) {
                        case '1_year':
                          longTermDue.setFullYear(issueDate.getFullYear() + 1);
                          break;
                        case '2_years':
                          longTermDue.setFullYear(issueDate.getFullYear() + 2);
                          break;
                        case '3_years':
                          longTermDue.setFullYear(issueDate.getFullYear() + 3);
                          break;
                        case '4_years':
                          longTermDue.setFullYear(issueDate.getFullYear() + 4);
                          break;
                      }
                      setDueDate(format(longTermDue, 'yyyy-MM-dd'));
                    }
                  }}
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
                {borrowingType === 'long_term' && (
                  <p className="text-xs text-blue-600 mt-1">
                    No overdue fines will apply for long-term borrowing
                  </p>
                )}
              </div>
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
            disabled={
              !selectedBorrower || 
              (borrowingLimit && borrowingItems.length >= borrowingLimit.remaining_slots + borrowingLimit.current_borrowed) ||
              (borrowingLimit && !borrowingLimit.can_borrow && borrowingItems.length >= 1)
            }
            title={
              !selectedBorrower 
                ? 'Please select a borrower first' 
                : (borrowingLimit && borrowingItems.length >= borrowingLimit.remaining_slots + borrowingLimit.current_borrowed)
                  ? `Borrowing limit reached (${borrowingLimit.max_allowed} books maximum)`
                  : 'Add another book'
            }
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
                  
                  {item.tracking_code.trim() && !item.copy_data && !activeValidations[item.id] && (
                    <div className="bg-red-50 p-3 rounded-md">
                      <h4 className="font-medium text-red-800 mb-2">❌ Book Not Available</h4>
                      <p className="text-sm text-red-700">Book with tracking code "{item.tracking_code}" is not available for issue.</p>
                      <p className="text-xs text-gray-600 mt-1">Try entering the book's legacy ID number or exact copy identifier.</p>
                    </div>
                  )}
                  
                  {activeValidations[item.id] && (
                    <div className="bg-blue-50 p-3 rounded-md">
                      <h4 className="font-medium text-blue-800 mb-2">🔍 Searching...</h4>
                      <p className="text-sm text-blue-700">Looking for book with tracking code "{item.tracking_code}"</p>
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