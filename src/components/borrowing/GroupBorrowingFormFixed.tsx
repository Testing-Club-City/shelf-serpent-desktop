import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BookOpen, User, Calendar, AlertCircle, Users, Plus, Trash2, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { invoke } from '@tauri-apps/api/core';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDebouncedCallback } from '@/hooks/useDebounce';

interface GroupBorrowingFormProps {
  onSubmit: (groupBorrowing: any) => void;
  onCancel: () => void;
  preselectedCopy?: any;
}

export const GroupBorrowingFormFixed: React.FC<GroupBorrowingFormProps> = ({
  onSubmit,
  onCancel,
  preselectedCopy,
}) => {
  const [studentAdmissions, setStudentAdmissions] = useState<string[]>(['']);
  const [selectedStudents, setSelectedStudents] = useState<any[]>([]);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [studentSearchStates, setStudentSearchStates] = useState<boolean[]>([false]);
  const { toast } = useToast();

  // Set preselected book if provided
  useEffect(() => {
    if (preselectedCopy) {
      setSelectedBook(preselectedCopy);
      setTrackingCode(preselectedCopy.tracking_code || preselectedCopy.id);
    }
  }, [preselectedCopy]);

  // Set default return date (14 days from now)
  useEffect(() => {
    const defaultReturnDate = new Date();
    defaultReturnDate.setDate(defaultReturnDate.getDate() + 14);
    setReturnDate(defaultReturnDate.toISOString().split('T')[0]);
  }, []);

  const searchStudentByAdmission = async (admissionNumber: string, index: number) => {
    try {
      setStudentSearchStates(prev => {
        const updated = [...prev];
        updated[index] = true;
        return updated;
      });

      const trimmedAdmission = admissionNumber.trim();
      if (!trimmedAdmission) return;

      // Search for student using offline-first approach
      const student = await invoke('search_student_by_admission', {
        admissionNumber: trimmedAdmission
      });

      if (student) {
        // Check for duplicate
        const existingIndex = selectedStudents.findIndex(s => s?.admission_number === student.admission_number);
        
        if (existingIndex !== -1 && existingIndex !== index) {
          toast({
            title: "Student already added",
            description: `Student ${student.first_name} ${student.last_name} is already in the group.`,
            variant: "destructive",
          });
          return;
        }

        setSelectedStudents(prev => {
          const updated = [...prev];
          updated[index] = student;
          return updated;
        });
      } else {
        toast({
          title: "Student not found",
          description: `No active student found with admission number ${trimmedAdmission}.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error searching for student:', error);
      toast({
        title: "Error",
        description: "Failed to search for student",
        variant: "destructive",
      });
    } finally {
      setStudentSearchStates(prev => {
        const updated = [...prev];
        updated[index] = false;
        return updated;
      });
    }
  };

  const searchBookByTracking = async (code: string) => {
    if (!code.trim()) {
      toast({
        title: "Missing Tracking Code",
        description: "Please enter a book tracking code or legacy book ID to search.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    
    try {
      // Search for book copy using offline-first approach
      let bookCopy = await invoke('search_book_copy_by_tracking', {
        trackingCode: code.trim()
      });

      // Try legacy book ID if numeric
      if (!bookCopy && !isNaN(parseInt(code))) {
        bookCopy = await invoke('search_book_copy_by_id', {
          bookId: parseInt(code)
        });
      }

      if (bookCopy) {
        setSelectedBook(bookCopy);
        toast({
          title: "Book found",
          description: `Found ${bookCopy.book.title} by ${bookCopy.book.author}`,
        });
      } else {
        toast({
          title: "Book not found",
          description: "No book found with that tracking code or ID.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error searching for book:', error);
      toast({
        title: "Error",
        description: "Failed to search for book",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const debouncedSearchBook = useDebouncedCallback(searchBookByTracking, 500);

  const handleAdmissionChange = (value: string, index: number) => {
    const updated = [...studentAdmissions];
    updated[index] = value;
    setStudentAdmissions(updated);

    // Clear selection if empty
    if (!value.trim()) {
      const updatedStudents = [...selectedStudents];
      updatedStudents[index] = null;
      setSelectedStudents(updatedStudents);
    }
  };

  const addStudentInput = () => {
    setStudentAdmissions(prev => [...prev, '']);
    setSelectedStudents(prev => [...prev, null]);
    setStudentSearchStates(prev => [...prev, false]);
  };

  const removeStudentInput = (index: number) => {
    if (studentAdmissions.length > 1) {
      setStudentAdmissions(prev => prev.filter((_, i) => i !== index));
      setSelectedStudents(prev => prev.filter((_, i) => i !== index));
      setStudentSearchStates(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (selectedStudents.filter(s => s).length === 0) {
      toast({
        title: "No Students Selected",
        description: "Please add at least one student to the group.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedBook) {
      toast({
        title: "No Book Selected",
        description: "Please select a book for the group borrowing.",
        variant: "destructive",
      });
      return;
    }

    if (!returnDate) {
      toast({
        title: "Return Date Required",
        description: "Please set a return date for the group borrowing.",
        variant: "destructive",
      });
      return;
    }

    if (!purpose) {
      toast({
        title: "Purpose Required",
        description: "Please specify the purpose for the group borrowing.",
        variant: "destructive",
      });
      return;
    }

    const groupBorrowing = {
      student_admissions: selectedStudents.filter(s => s).map(s => s.admission_number),
      book_copy_id: selectedBook.id,
      tracking_code: selectedBook.tracking_code,
      borrowed_date: new Date().toISOString(),
      return_date: new Date(returnDate).toISOString(),
      purpose,
      notes,
      status: 'active',
      student_count: selectedStudents.filter(s => s).length,
    };

    onSubmit(groupBorrowing);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Group Borrowing Details
        </h3>
      </div>

      {/* Book Selection */}
      <div className="space-y-4">
        <Label htmlFor="book-search">Book to Borrow</Label>
        <div className="flex gap-2">
          <Input
            id="book-search"
            placeholder="Enter tracking code or book ID..."
            value={trackingCode}
            onChange={(e) => {
              setTrackingCode(e.target.value);
              debouncedSearchBook(e.target.value);
            }}
            disabled={!!preselectedCopy}
          />
          <Button
            type="button"
            onClick={() => searchBookByTracking(trackingCode)}
            disabled={isSearching || !!preselectedCopy}
            className="whitespace-nowrap"
          >
            {isSearching ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span className="ml-2">Searching...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </div>

        {selectedBook && (
          <Alert>
            <BookOpen className="h-4 w-4" />
            <AlertDescription>
              Selected: <strong>{selectedBook.book.title}</strong> by {selectedBook.book.author} 
              (Copy #{selectedBook.copy_number})
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Students Selection */}
      <div className="space-y-4">
        <Label>Students in Group</Label>
        {studentAdmissions.map((admission, index) => (
          <div key={index} className="flex gap-2 items-start">
            <div className="flex-1">
              <Input
                placeholder="Enter admission number..."
                value={admission}
                onChange={(e) => handleAdmissionChange(e.target.value, index)}
                onBlur={() => searchStudentByAdmission(admission, index)}
              />
              {selectedStudents[index] && (
                <div className="mt-2 p-2 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="text-sm">
                      {selectedStudents[index].first_name} {selectedStudents[index].last_name}
                    </span>
                    <Badge variant="outline">{selectedStudents[index].class_grade}</Badge>
                  </div>
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => searchStudentByAdmission(admission, index)}
              disabled={studentSearchStates[index]}
            >
              {studentSearchStates[index] ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => removeStudentInput(index)}
              disabled={studentAdmissions.length === 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStudentInput}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Student
        </Button>
      </div>

      {/* Return Date */}
      <div className="space-y-2">
        <Label htmlFor="return-date">Return Date</Label>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <Input
            id="return-date"
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      {/* Purpose */}
      <div className="space-y-2">
        <Label htmlFor="purpose">Purpose</Label>
        <Input
          id="purpose"
          placeholder="e.g., Group study, class project..."
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Additional Notes (Optional)</Label>
        <Textarea
          id="notes"
          placeholder="Any special instructions or notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      {/* Summary */}
      <div className="border rounded-lg p-4 space-y-2">
        <h4 className="font-semibold">Summary</h4>
        <div className="text-sm space-y-1">
          <div>Students: {selectedStudents.filter(s => s).length}</div>
          <div>Book: {selectedBook?.book?.title || 'None selected'}</div>
          <div>Return Date: {returnDate ? new Date(returnDate).toLocaleDateString() : 'Not set'}</div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={selectedStudents.filter(s => s).length === 0 || !selectedBook || !returnDate || !purpose}>
          Create Group Borrowing
        </Button>
      </div>
    </form>
  );
};
