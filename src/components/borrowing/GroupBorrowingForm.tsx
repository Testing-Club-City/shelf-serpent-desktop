import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BookOpen, User, Calendar, AlertCircle, Users, Plus, Trash2, Search } from 'lucide-react';
import { useBooks } from '@/hooks/useBooks';
import { useBorrowingSettings } from '@/hooks/useBorrowingSettings';
import { addDays, format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDebouncedCallback } from '@/hooks/useDebounce';

interface GroupBorrowingFormProps {
  onSubmit: (groupBorrowing: any) => void;
  onCancel: () => void;
  preselectedCopy?: any;
}

export const GroupBorrowingForm: React.FC<GroupBorrowingFormProps> = ({
  onSubmit,
  onCancel,
  preselectedCopy
}) => {
  const { data: books } = useBooks();
  const { calculateDueDate, getBorrowingPeriodDays } = useBorrowingSettings();
  const { toast } = useToast();
  
  // Student admission numbers
  const [studentAdmissions, setStudentAdmissions] = useState<string[]>(['']);
  const [selectedStudents, setSelectedStudents] = useState<any[]>([]);
  const [studentSearchStates, setStudentSearchStates] = useState<boolean[]>([false]);
  
  const [trackingCode, setTrackingCode] = useState('');
  const [bookCopy, setBookCopy] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [borrowedDate, setBorrowedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState(calculateDueDate());
  const [conditionAtIssue, setConditionAtIssue] = useState('good');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-select book if preselected copy is provided
  useEffect(() => {
    if (preselectedCopy) {
      setBookCopy(preselectedCopy);
      setTrackingCode(preselectedCopy.tracking_code || '');
      setConditionAtIssue(preselectedCopy.condition || 'good');
    }
  }, [preselectedCopy]);

  // Auto-update due date when borrowed date changes
  const handleBorrowedDateChange = (date: string) => {
    setBorrowedDate(date);
    const newDueDate = calculateDueDate(new Date(date));
    setDueDate(newDueDate);
  };

  const handleAddStudent = () => {
    // Initialize new arrays with default values
    const newAdmissions = [...studentAdmissions, ''];
    const newSelectedStudents = [...selectedStudents, null];
    const newSearchStates = [...studentSearchStates, false];
    
    // Update all states in a single batch to prevent race conditions
    setStudentAdmissions(newAdmissions);
    setSelectedStudents(newSelectedStudents);
    setStudentSearchStates(newSearchStates);
  };

  const handleRemoveStudent = (index: number) => {
    if (studentAdmissions.length > 1) {
      const updatedAdmissions = [...studentAdmissions];
      updatedAdmissions.splice(index, 1);
      setStudentAdmissions(updatedAdmissions);
      
      const updatedSelectedStudents = [...selectedStudents];
      updatedSelectedStudents.splice(index, 1);
      setSelectedStudents(updatedSelectedStudents);
      
      const updatedSearchStates = [...studentSearchStates];
      updatedSearchStates.splice(index, 1);
      setStudentSearchStates(updatedSearchStates);
    }
  };

  // Debounced admission number search
  const searchStudentByAdmission = async (admissionNumber: string, index: number) => {
    try {
      if (!admissionNumber || !admissionNumber.trim()) {
        // Clear the selected student if the input is empty
        setSelectedStudents(prev => {
          const updated = [...prev];
          updated[index] = null;
          return updated;
        });
        return;
      }

      // Update loading state for this input
      setStudentSearchStates(prev => {
        const updated = [...prev];
        updated[index] = true;
        return updated;
      });

      // Make sure we have a valid admission number
      const trimmedAdmission = admissionNumber.trim();
      if (!trimmedAdmission) return;

      // Search for the student
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, admission_number, class_grade')
        .eq('admission_number', trimmedAdmission)
        .eq('status', 'active')
        .maybeSingle();

      // Handle response
      if (error) {
        console.error('Error searching for student:', error);
        return;
      }

      // Update the selected students state
      setSelectedStudents(prev => {
        const updated = [...prev];
        
        // If no student found, clear the selection
        if (!data) {
          updated[index] = null;
          return updated;
        }

        // Check for duplicate student
        const isDuplicate = prev.some((student, i) => 
          i !== index && student && student.id === data.id
        );

        if (isDuplicate) {
          toast({
            title: "Duplicate Student",
            description: `Student ${data.first_name} ${data.last_name} is already added to the group.`,
            variant: "destructive",
          });
          updated[index] = null;
        } else {
          updated[index] = data;
          toast({
            title: "Student Found",
            description: `Added: ${data.first_name} ${data.last_name} (${data.class_grade})`,
          });
        }
        
        return updated;
      });
    } catch (error) {
      console.error('Error in searchStudentByAdmission:', error);
      toast({
        title: "Error",
        description: "An error occurred while searching for the student.",
        variant: "destructive",
      });
    } finally {
      // Reset loading state for this input
      setStudentSearchStates(prev => {
        const updated = [...prev];
        updated[index] = false;
        return updated;
      });
    }
  };

  const handleAdmissionChange = (value: string, index: number) => {
    // Only update if the value has actually changed
    if (studentAdmissions[index] === value) return;
    
    // Create new arrays with the updated admission number
    const updatedAdmissions = [...studentAdmissions];
    updatedAdmissions[index] = value;
    
    // Update the admissions state
    setStudentAdmissions(updatedAdmissions);
    
    // If the input is cleared, also clear the selected student
    if (!value.trim()) {
      setSelectedStudents(prev => {
        const updated = [...prev];
        updated[index] = null;
        return updated;
      });
    }
  };

  // Debounce the search
  const debouncedSearchStudentByAdmission = useDebouncedCallback(searchStudentByAdmission, 500);

  // Track previous admission numbers to detect changes
  const prevAdmissionsRef = useRef<string[]>([]);

  useEffect(() => {
    // Only run the effect if studentAdmissions has actually changed
    if (JSON.stringify(prevAdmissionsRef.current) !== JSON.stringify(studentAdmissions)) {
      studentAdmissions.forEach((admission, index) => {
        // Only search if the field has content and it's different from previous value
        const prevAdmission = prevAdmissionsRef.current[index] || '';
        if (admission.trim() && admission !== prevAdmission) {
          debouncedSearchStudentByAdmission(admission, index);
        }
      });
      prevAdmissionsRef.current = [...studentAdmissions];
    }
  }, [studentAdmissions, debouncedSearchStudentByAdmission]);

  // Search for book copy by tracking code or legacy book ID
  const handleSearchBookCopy = async () => {
    if (!trackingCode) {
      toast({
        title: "Missing Tracking Code",
        description: "Please enter a book tracking code or legacy book ID to search.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    
    try {
      // First try to search by tracking code
      let { data, error } = await supabase
        .from('book_copies')
        .select(`
          *,
          books (
            id,
            title,
            author,
            isbn,
            categories (
              id,
              name
            )
          )
        `)
        .eq('tracking_code', trackingCode)
        .eq('status', 'available')
        .single();

      // If not found by tracking code, try legacy book ID if the input is numeric
      if (!data && !isNaN(parseInt(trackingCode))) {
        const legacyBookId = parseInt(trackingCode);
        const legacyResult = await supabase
          .from('book_copies')
          .select(`
            *,
            books (
              id,
              title,
              author,
              isbn,
              categories (
                id,
                name
              )
            )
          `)
          .eq('legacy_book_id', legacyBookId)
          .eq('status', 'available')
          .single();
        
        data = legacyResult.data;
        error = legacyResult.error;
      }

      if (error) {
        console.error('Error searching for book copy:', error);
        toast({
          title: "Error",
          description: "Failed to find book copy with that tracking code or legacy book ID.",
          variant: "destructive",
        });
        setBookCopy(null);
        return;
      }

      if (!data) {
        toast({
          title: "Book Copy Not Found",
          description: "No available book copy found with that tracking code or legacy book ID.",
          variant: "destructive",
        });
        setBookCopy(null);
        return;
      }

      console.log('Found book copy:', data);
      setBookCopy(data);
      setConditionAtIssue(data.condition);
      
      toast({
        title: "Book Copy Found",
        description: `Found: ${data.books.title} (Copy #${data.copy_number})`,
      });
    } catch (error) {
      console.error('Error searching for book copy:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while searching for the book copy.",
        variant: "destructive",
      });
      setBookCopy(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!bookCopy) {
      toast({
        title: "Missing Book",
        description: "Please search for and select a book copy.",
        variant: "destructive",
      });
      return;
    }

    const validStudents = selectedStudents.filter(student => student !== null);
    if (validStudents.length === 0) {
      toast({
        title: "Missing Students",
        description: "Please add at least one student to the group.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const groupBorrowing = {
        book_copy_id: bookCopy.id,
        book_id: bookCopy.book_id,
        student_ids: validStudents.map(student => student.id),
        borrowed_date: borrowedDate,
        due_date: dueDate,
        condition_at_issue: conditionAtIssue,
        notes: notes,
        tracking_code: trackingCode,
      };

      await onSubmit(groupBorrowing);
    } catch (error) {
      console.error('Error submitting group borrowing:', error);
      toast({
        title: "Error",
        description: "Failed to create group borrowing. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Group Borrowing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Book Copy Search */}
          <div className="space-y-4">
            <Label>Book Copy</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter tracking code"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                className="font-mono"
              />
              <Button 
                type="button"
                variant="outline"
                onClick={handleSearchBookCopy}
                disabled={isSearching}
              >
                {isSearching ? (
                  <>Searching...</>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>

            {bookCopy && (
              <div className="p-4 border rounded-lg bg-muted">
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 mt-1 text-muted-foreground" />
                  <div className="space-y-1">
                    <h4 className="font-medium">{bookCopy.books.title}</h4>
                    <p className="text-sm text-muted-foreground">by {bookCopy.books.author}</p>
                    <div className="flex gap-2">
                      <Badge variant="outline">Copy #{bookCopy.copy_number}</Badge>
                      <Badge variant="outline" className="capitalize">{bookCopy.condition}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Student Selection */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Students</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddStudent}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Student
              </Button>
            </div>

            <div className="space-y-3">
              {studentAdmissions.map((admission, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <div className="relative">
                      <Input
                        placeholder="Enter admission number..."
                        value={admission}
                        onChange={(e) => handleAdmissionChange(e.target.value, index)}
                        className="pr-8"
                      />
                      {studentSearchStates[index] && (
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        </div>
                      )}
                    </div>
                    
                    {selectedStudents[index] && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <User className="h-4 w-4" />
                        <span>{selectedStudents[index].first_name} {selectedStudents[index].last_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {selectedStudents[index].class_grade}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {studentAdmissions.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveStudent(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Borrowing Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Borrowed Date</Label>
              <Input
                type="date"
                value={borrowedDate}
                onChange={(e) => handleBorrowedDateChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Condition at Issue</Label>
            <Select value={conditionAtIssue} onValueChange={setConditionAtIssue}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Add any notes about this group borrowing..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Group Borrowing'}
        </Button>
      </div>
    </form>
  );
}; 