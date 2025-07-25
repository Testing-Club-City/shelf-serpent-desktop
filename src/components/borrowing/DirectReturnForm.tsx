import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BookOpen, Search, Shield, AlertTriangle, Currency, BookX, CheckCircle } from 'lucide-react';
import { useBorrowingsArray } from '@/hooks/useBorrowings';
import { useBookReturn } from '@/hooks/useBorrowings';
import { calculateConditionFine, getFineAmountBySetting } from '@/hooks/useFineManagement';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentMetaContext } from '@/hooks/useDocumentMetaContext';

// Helper function to calculate fines based on admin settings
async function calculateConditionFineWithSettings(condition: string, daysOverdue: number = 0) {
  // First, calculate the overdue fine
  let overdueFine = 0;
  if (daysOverdue > 0) {
    const overdueRatePerDay = await getFineAmountBySetting('overdue');
    overdueFine = daysOverdue * overdueRatePerDay;
  }
  
  // Then calculate condition-based fine using admin settings
  let conditionFine = 0;
  switch (condition) {
    case 'excellent':
    case 'good':
      conditionFine = 0;
      break;
    case 'fair':
      conditionFine = await getFineAmountBySetting('condition_fair');
      break;
    case 'poor':
      conditionFine = await getFineAmountBySetting('condition_poor');
      break;
    case 'damaged':
      conditionFine = await getFineAmountBySetting('damaged');
      break;
    case 'lost':
      conditionFine = await getFineAmountBySetting('lost_book');
      break;
    default:
      conditionFine = 0;
  }
  
  return overdueFine + conditionFine;
}

interface DirectReturnFormProps {
  onCancel: () => void;
}

export const DirectReturnForm: React.FC<DirectReturnFormProps> = ({
  onCancel,
}) => {
  const { data: borrowings, isLoading } = useBorrowingsArray();
  const bookReturn = useBookReturn();
  const { toast } = useToast();
  const { updatePageState } = useDocumentMetaContext();
  
  const [bookCode, setBookCode] = useState('');
  const [isValidated, setIsValidated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState('');
  
  // Enhanced search states
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [formatError, setFormatError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Debounced search term
  const debouncedSearchTerm = useDebounce(bookCode, 300);
  
  // These states are set after validation
  const [expectedBorrowing, setExpectedBorrowing] = useState<any>(null);
  const [victimBorrowing, setVictimBorrowing] = useState<any>(null);
  const [isTheftDetected, setIsTheftDetected] = useState(false);
  const [theftFineAmount, setTheftFineAmount] = useState<number>(800); // Default theft fine
  
  // For normal returns
  const [conditionAtReturn, setConditionAtReturn] = useState('good');
  const [returnNotes, setReturnNotes] = useState('');
  
  // Fine amounts from admin settings
  const [fairFine, setFairFine] = useState<number>(50);
  const [poorFine, setPoorFine] = useState<number>(150);
  const [damagedFine, setDamagedFine] = useState<number>(300);
  const [lostFine, setLostFine] = useState<number>(500);
  
  // Active borrowings for finding potential thieves
  // Memoize active borrowings to prevent infinite useEffect loops
  const activeBorrowings = useMemo(() => {
    return borrowings?.filter(b => b.status === 'active') || [];
  }, [borrowings]);
  
  // Update document meta when component mounts
  useEffect(() => {
    updatePageState('idle', 'Scan Book Return');
    return () => {
      // Reset when component unmounts
      updatePageState('idle', 'Borrowing Management');
    };
  }, [updatePageState]);
  
  // Load the fine amounts from admin settings
  useEffect(() => {
    const loadFineAmounts = async () => {
      try {
        // Load theft fine
        const theftFine = await getFineAmountBySetting('stolen_book');
        if (theftFine > 0) {
          setTheftFineAmount(theftFine);
        }
        
        // Load condition-based fines
        const fairAmount = await getFineAmountBySetting('condition_fair');
        if (fairAmount > 0) setFairFine(fairAmount);
        
        const poorAmount = await getFineAmountBySetting('condition_poor');
        if (poorAmount > 0) setPoorFine(poorAmount);
        
        const damagedAmount = await getFineAmountBySetting('damaged');
        if (damagedAmount > 0) setDamagedFine(damagedAmount);
        
        const lostAmount = await getFineAmountBySetting('lost_book');
        if (lostAmount > 0) setLostFine(lostAmount);
      } catch (error) {
        console.error('Error loading fine amounts:', error);
      }
    };
    
    loadFineAmounts();
  }, []);

  // Tracking code format validation - Simple format only
  const validateTrackingCodeFormat = (code: string): boolean => {
    // Expected format: ABC/001/25 (book_code/copy_number/year)
    // - 2-4 uppercase letters or alphanumeric characters for book code
    // - 3 digits for copy number (001, 002, etc.)
    // - 2 digits for year (25 for 2025)
    const simplePattern = /^[A-Z0-9]{2,4}\/\d{3}\/\d{2}$/;
    
    return simplePattern.test(code);
  };

  // Real-time search effect (like GlobalSearchBar)
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchTerm || !debouncedSearchTerm.trim()) {
        setSearchResults([]);
        setShowSuggestions(false);
        setFormatError('');
        return;
      }

      // Validate format first
      if (!validateTrackingCodeFormat(debouncedSearchTerm?.trim()?.toUpperCase() || '')) {
        setFormatError('Invalid format. Expected: PREFIX/NUMBER/YEAR (e.g., ACC/001/24)');
        setSearchResults([]);
        setShowSuggestions(false);
        return;
      }

      setFormatError('');
      setIsSearching(true);

      try {
      // Search active borrowings for matching tracking codes
      const searchLower = debouncedSearchTerm?.toLowerCase() || '';
        const results = activeBorrowings.filter(borrowing => 
          borrowing.tracking_code?.toLowerCase() === searchLower
        );

        // If no direct match found, also search for book copies with this tracking code
        if (results.length === 0) {
          const { data: bookCopy } = await supabase
            .from('book_copies')
            .select('tracking_code, id, book_id')
            .eq('tracking_code', debouncedSearchTerm?.trim() || '')
            .single();

          if (bookCopy) {
            // If book copy exists, find any active borrowings for this copy
            const copyBorrowings = activeBorrowings.filter(borrowing => 
              borrowing.book_copy_id === bookCopy.id
            );
            
            if (copyBorrowings.length > 0) {
              results.push(...copyBorrowings);
            }
          }
        }

        setSearchResults(results);
        setShowSuggestions(results.length > 0);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearchTerm, activeBorrowings]);

  // Handle input change with automatic uppercase conversion
  const handleInputChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setBookCode(upperValue);
    
    // Clear validation states when typing
    if (isValidated) {
      setIsValidated(false);
      setExpectedBorrowing(null);
      setVictimBorrowing(null);
      setIsTheftDetected(false);
      setValidationError('');
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (borrowing: any) => {
    setBookCode(borrowing.tracking_code);
    setShowSuggestions(false);
    setExpectedBorrowing(borrowing);
    setIsValidated(true);
  };

  const handleValidateBook = async () => {
    if (!bookCode?.trim()) {
      setValidationError('Please enter a book code');
      return;
    }
    
    setIsProcessing(true);
    setValidationError('');
    updatePageState('loading', 'Validating Book Code');
    
    try {
      // Step 1: Check if this book code matches any active borrowing
      const matchingBorrowing = activeBorrowings.find(b => 
        b.tracking_code?.toLowerCase() === bookCode?.toLowerCase()?.trim()
      );
      
      if (matchingBorrowing) {
        // Normal return case - book code matches an active borrowing
        setExpectedBorrowing(matchingBorrowing);
        setIsValidated(true);
        setIsTheftDetected(false);
        setVictimBorrowing(null);
        updatePageState('success', `Valid Book: ${matchingBorrowing.books?.title}`);
      } else {
        // Book code doesn't match any active borrowing
        // Check if it's a book that belongs to someone else (theft case)
        const { data, error } = await supabase
          .from('borrowings')
          .select(`
            *,
            students (id, first_name, last_name, admission_number, class_grade),
            books (id, title, author)
          `)
          .eq('tracking_code', bookCode?.trim() || '')
          .eq('status', 'active')
          .single();
          
        if (data) {
          // Book belongs to another student - theft case
          setVictimBorrowing(data);
          setIsTheftDetected(true);
          setIsValidated(true);
          setExpectedBorrowing(null);
          updatePageState('error', `⚠️ THEFT DETECTED: Book belongs to ${data.students.first_name}`);
        } else {
          // Book code not found at all
          setValidationError('Book code not found in any active borrowing. Please check the code and try again.');
          updatePageState('error', 'Invalid Book Code');
        }
      }
    } catch (error) {
      console.error('Error validating book code:', error);
      setValidationError('An error occurred while validating the book code.');
      updatePageState('error', 'Error Validating Book');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessReturn = async () => {
    if (!isValidated) return;
    
    setIsProcessing(true);
    updatePageState('submitting', isTheftDetected ? 'Processing Theft Case' : 'Processing Book Return');
    
    try {
      if (expectedBorrowing) {
        // Process normal return
        await bookReturn.mutateAsync({
          id: expectedBorrowing.id,
          condition_at_return: conditionAtReturn,
          fine_amount: await calculateConditionFineWithSettings(conditionAtReturn, 0), // Use dynamic fine calculation
          notes: returnNotes,
          is_lost: false,
          returned_tracking_code: bookCode,
          prevent_auto_fine: false,
          book_verified: true
        });
        
        toast({
          title: "Book Returned Successfully",
          description: `The book has been returned and marked as complete.`,
        });
        
        updatePageState('success', 'Book Return Successful');
      } else if (isTheftDetected && victimBorrowing) {
        // Process theft case
        
        // 1. Mark the victim's book as returned
        await bookReturn.mutateAsync({
          id: victimBorrowing.id,
          condition_at_return: conditionAtReturn,
          fine_amount: 0, // No fine for the victim
          notes: `Book was stolen and returned by another student. Original student is not at fault.`,
          is_lost: false,
          returned_tracking_code: bookCode,
          prevent_auto_fine: true,
          book_verified: true
        });
        
        // 2. Create a fine for the thief (current student returning the wrong book)
        if (activeBorrowings.length > 0) {
          const thiefBorrowing = activeBorrowings[0]; // Use the first active borrowing for the thief
          
          // Create a fine record for the thief
          await supabase.from('fines').insert({
            student_id: thiefBorrowing.student_id,
            borrowing_id: thiefBorrowing.id,
            amount: theftFineAmount,
            fine_type: 'stolen_book',
            description: `Theft fine: Student returned book (${bookCode}) belonging to ${victimBorrowing.students.first_name} ${victimBorrowing.students.last_name}`,
            status: 'unpaid',
            created_at: new Date().toISOString()
          });
          
          // 3. Mark the thief's original book as lost
          await bookReturn.mutateAsync({
            id: thiefBorrowing.id,
            condition_at_return: 'lost',
            fine_amount: 0, // We already added the theft fine separately
            notes: `Student returned another student's book (${bookCode}) instead of this one. Marked as lost and theft fine issued.`,
            is_lost: true,
            lost_reason: 'Theft case: Student returned someone else\'s book',
            returned_tracking_code: '',
            prevent_auto_fine: true,
            book_verified: false
          });
          
          // 4. Create a theft report for tracking
          await supabase.from('theft_reports').insert({
            student_id: thiefBorrowing.student_id,
            book_id: victimBorrowing.book_id,
            book_copy_id: victimBorrowing.book_copy_id,
            borrowing_id: victimBorrowing.id,
            expected_tracking_code: thiefBorrowing.tracking_code,
            returned_tracking_code: bookCode,
            reported_date: new Date().toISOString(),
            resolution_date: new Date().toISOString(),
            theft_reason: 'Student returned book belonging to another student',
            status: 'resolved',
            resolution_notes: `Theft detected during return process. Fine of ${formatCurrency(theftFineAmount)} issued to student.`
          });
        }
        
        toast({
          title: "Theft Case Processed",
          description: `The stolen book has been returned to its rightful owner and a fine has been issued to the student who took it.`,
        });
        
        updatePageState('success', 'Theft Case Processed');
      }
      
      onCancel(); // Close the form after successful processing
    } catch (error) {
      console.error('Error processing return:', error);
      toast({
        title: "Error",
        description: "Failed to process the return. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />
            Book Return Process
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Step 1: Book Code Entry and Validation */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Enter Book Code</div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={bookCode}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="Enter book tracking code..."
                    className="pl-10 font-mono"
                    disabled={isValidated || isProcessing}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    onFocus={() => setShowSuggestions(searchResults.length > 0)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  />
                  {/* Format error message */}
                  {formatError && (
                    <div className="absolute left-0 mt-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 z-10">
                      <AlertTriangle className="inline h-3 w-3 mr-1" />
                      {formatError}
                    </div>
                  )}
                  {/* Suggestions dropdown */}
                  {showSuggestions && searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-20 max-h-56 overflow-y-auto">
                      {searchResults.map((borrowing, idx) => (
                        <div
                          key={borrowing.id}
                          className="px-3 py-2 cursor-pointer hover:bg-blue-50 flex flex-col gap-0.5"
                          onMouseDown={() => handleSuggestionSelect(borrowing)}
                        >
                          <span className="font-mono text-sm text-blue-900">{borrowing.tracking_code}</span>
                          <span className="text-xs text-gray-600">{borrowing.books?.title} — {borrowing.students?.first_name} {borrowing.students?.last_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button 
                  onClick={handleValidateBook} 
                  disabled={!bookCode?.trim() || isProcessing || isValidated}
                  className="min-w-24"
                >
                  {isProcessing ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
                      Checking...
                    </>
                  ) : (
                    'Verify Book'
                  )}
                </Button>
              </div>
              
              {validationError && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
            </div>
            
            {/* Step 2: Show Validation Results */}
            {isValidated && (
              <div className="pt-2 border-t">
                {expectedBorrowing ? (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Book Verified Successfully</AlertTitle>
                    <AlertDescription>
                      <div className="space-y-2 mt-2">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="font-medium text-green-900">Book:</p>
                            <p className="text-green-800">{expectedBorrowing.books?.title}</p>
                          </div>
                          <div>
                            <p className="font-medium text-green-900">Student:</p>
                            <p className="text-green-800">{expectedBorrowing.students?.first_name} {expectedBorrowing.students?.last_name}</p>
                          </div>
                          <div>
                            <p className="font-medium text-green-900">Class:</p>
                            <p className="text-green-800">{expectedBorrowing.students?.class_grade}</p>
                          </div>
                          <div>
                            <p className="font-medium text-green-900">Due Date:</p>
                            <p className="text-green-800">{format(new Date(expectedBorrowing.due_date), 'MMM dd, yyyy')}</p>
                          </div>
                        </div>
                        
                        <div className="pt-2">
                          <label className="block text-sm font-medium text-green-900 mb-1">Book Condition:</label>
                          <select
                            value={conditionAtReturn}
                            onChange={(e) => setConditionAtReturn(e.target.value)}
                            className="w-full p-2 rounded-md border border-green-300 focus:ring-green-500 focus:border-green-500"
                          >
                            <option value="excellent">Excellent (No fine)</option>
                            <option value="good">Good (No fine)</option>
                            <option value="fair">Fair (KES {fairFine} fine)</option>
                            <option value="poor">Poor (KES {poorFine} fine)</option>
                            <option value="damaged">Damaged (KES {damagedFine} fine)</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-green-900 mb-1">Return Notes (Optional):</label>
                          <textarea
                            value={returnNotes}
                            onChange={(e) => setReturnNotes(e.target.value)}
                            className="w-full p-2 rounded-md border border-green-300 focus:ring-green-500 focus:border-green-500"
                            rows={2}
                            placeholder="Add any notes about the return..."
                          ></textarea>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : isTheftDetected && victimBorrowing ? (
                  <Alert variant="destructive">
                    <Shield className="h-4 w-4" />
                    <AlertTitle className="text-lg">⚠️ Book Belongs to Another Student</AlertTitle>
                    <AlertDescription>
                      <div className="space-y-4 mt-2">
                        <p className="text-sm">
                          The book with tracking code <code className="bg-red-100 px-1 py-0.5 rounded">{bookCode}</code> belongs 
                          to another student. This is a theft case.
                        </p>
                        
                        <div className="bg-white/20 p-3 rounded-md border border-red-400">
                          <h4 className="font-medium text-sm mb-2 underline">Book Owner Details:</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="font-medium">Student:</p>
                              <p>{victimBorrowing.students.first_name} {victimBorrowing.students.last_name}</p>
                            </div>
                            <div>
                              <p className="font-medium">Admission No:</p>
                              <p>{victimBorrowing.students.admission_number}</p>
                            </div>
                            <div>
                              <p className="font-medium">Class:</p>
                              <p>{victimBorrowing.students.class_grade}</p>
                            </div>
                            <div>
                              <p className="font-medium">Book:</p>
                              <p>{victimBorrowing.books.title}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-red-700 text-white p-3 rounded-md">
                          <h4 className="font-bold text-sm mb-1">Action to be taken:</h4>
                          <p className="text-sm">
                            1. The book will be returned to its rightful owner ({victimBorrowing.students.first_name})
                          </p>
                          <p className="text-sm">
                            2. The current student will be fined {formatCurrency(theftFineAmount)} for theft
                          </p>
                          <p className="text-sm">
                            3. The current student's original book will be marked as lost
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1 text-white">Return Notes (Optional):</label>
                          <textarea
                            value={returnNotes}
                            onChange={(e) => setReturnNotes(e.target.value)}
                            className="w-full p-2 rounded-md border"
                            rows={2}
                            placeholder="Add any notes about this theft case..."
                          ></textarea>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Action Buttons */}
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
          Cancel
        </Button>
        <Button 
          onClick={handleProcessReturn}
          disabled={!isValidated || isProcessing}
          className={`min-w-[150px] ${isTheftDetected ? 'bg-red-600 hover:bg-red-700' : ''}`}
        >
          {isProcessing ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
              Processing...
            </>
          ) : isTheftDetected ? (
            <>
              <Shield className="h-4 w-4 mr-1.5" />
              Process Theft Case
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-1.5" />
              Complete Return
            </>
          )}
        </Button>
      </div>
      
      {/* Instructions */}
      {!isValidated && (
        <Alert variant="default" className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-800">
            <p className="font-medium">Instructions:</p>
            <ol className="list-decimal pl-5 text-sm space-y-1 mt-1">
              <li>Enter the tracking code from the book being returned</li>
              <li>Click "Verify Book" to check if the book belongs to an active borrowing</li>
              <li>The system will detect if this is a normal return or a theft case</li>
              <li>Follow the prompts to complete the return process</li>
            </ol>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
