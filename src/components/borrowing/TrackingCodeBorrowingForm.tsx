import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BookOpen, User, Calendar, AlertCircle, Search, Users, ArrowDown, CheckCircle, BookMarked, ArrowUp, Users2, GraduationCap, BookCheck } from 'lucide-react';
import { useBooks } from '@/hooks/useBooks';
import { useStudents } from '@/hooks/useStudents';
import { useClasses } from '@/hooks/useClasses';
import { useBorrowingSettings } from '@/hooks/useBorrowingSettings';
import { useTrackingCodeSearch } from '@/hooks/useTrackingCodeSearch';
import { useBorrowingsArray } from '@/hooks/useBorrowings';
import { addDays, format } from 'date-fns';
import { useDebounce } from '@/hooks/useDebounce';

interface TrackingCodeBorrowingFormProps {
  onSubmit: (borrowings: any[]) => void;
  onCancel: () => void;
}

// Type definitions
interface BookCopy {
  id: string;
  tracking_code: string;
  book_id: string;
  copy_number: number;
  condition: string;
  status: string;
  books: {
    id: string;
    title: string;
    author: string;
    book_code: string;
    isbn: string;
  };
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_grade: string;
  class_id: string;
}

interface Class {
  id: string;
  class_name: string;
  form_level: number;
  max_books_allowed: number;
}

export const TrackingCodeBorrowingForm: React.FC<TrackingCodeBorrowingFormProps> = ({
  onSubmit,
  onCancel
}) => {
  const { data: books = [] } = useBooks();
  const { data: studentsResponse } = useStudents();
  const { data: classes = [] } = useClasses();
  const { calculateDueDate, getBorrowingPeriodDays } = useBorrowingSettings();
  const { data: borrowings = [] } = useBorrowingsArray();

  // Extract students array safely
  const students = Array.isArray(studentsResponse?.students) ? studentsResponse.students : [];
  
  // State for form
  const [searchTerm, setSearchTerm] = useState('');
  const [borrowedDate, setBorrowedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState(calculateDueDate());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State for selections
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [selectedBooks, setSelectedBooks] = useState<BookCopy[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<'individual' | 'group'>('individual');
  
  // Debounced search
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  
  // Use tracking code search hook
  const { data: searchResults, isLoading: isSearching } = useTrackingCodeSearch(debouncedSearchTerm);
  
  // Active borrowings for validation
  const activeBorrowings = useMemo(() => {
    return (borrowings || []).filter(b => b.status === 'active');
  }, [borrowings]);

  // Get form level for the selected student
  const getFormLevel = () => {
    if (!selectedStudent) return null;
    
    const studentData = students?.find(s => s.id === selectedStudent);
    if (!studentData) return null;
    
    // Try to get form level from class record
    const studentClass = classes?.find(c => c.id === studentData.class_id);
    return studentClass?.form_level || null;
  };

  // Auto-update due date when borrowed date changes
  const handleBorrowedDateChange = (date: string) => {
    setBorrowedDate(date);
    const newDueDate = calculateDueDate(new Date(date));
    setDueDate(newDueDate);
  };

  // Handle search results based on type
  const handleSearchSelect = (result: BookCopy) => {
    if (!result || selectedBooks.find(b => b.id === result.id)) {
      return; // Already selected
    }
    
    // Check if this book is already borrowed by someone
    const existingBorrowing = activeBorrowings.find(b => 
      b.book_copy_id === result.id && b.status === 'active'
    );
    
    if (existingBorrowing) {
      alert('This book is already borrowed by another student');
      return;
    }
    
    setSelectedBooks(prev => [...prev, result]);
  };

  // Remove selected book
  const removeSelectedBook = (bookId: string) => {
    setSelectedBooks(prev => prev.filter(b => b.id !== bookId));
  };

  // Auto-detect assignment mode and student
  useEffect(() => {
    if (selectedBooks.length === 0) {
      setSelectedStudent(null);
      setAssignmentMode('individual');
      return;
    }

    // Try to detect assignment pattern
    const firstBook = selectedBooks[0];
    if (!firstBook?.tracking_code) return;

    // Extract class grade from tracking code format (e.g., "FORM1A001/24")
    const codeMatch = firstBook.tracking_code.match(/^([A-Z]+\d+[A-Z]?)/);
    if (!codeMatch) return;

    const classPrefix = codeMatch[1];
    let classGrade = '';
    
    // Parse the class grade from the prefix
    if (classPrefix.includes('FORM')) {
      const formMatch = classPrefix.match(/FORM(\d+)([A-Z]?)/);
      if (formMatch) {
        classGrade = formMatch[2] ? `Form ${formMatch[1]}${formMatch[2]}` : `Form ${formMatch[1]}`;
      }
    } else {
      // Handle other formats
      classGrade = classPrefix;
    }

    if (classGrade) {
      // Auto-detect student selection mode
      const classStudents = students?.filter(s => s.class_grade.toLowerCase().includes(classGrade.toLowerCase()));
      
      if (classStudents && classStudents.length > 0) {
        // Check if it's a group assignment (more than 1 student in the class)
        if (students?.filter(s => s.class_grade === classGrade).length > 1) {
          setAssignmentMode('group');
          
          // For group assignment, we might want to select the first student in the class
          const firstStudent = classStudents[0];
          setSelectedStudent(firstStudent.id);
        } else if (classStudents.length === 1) {
          // Single student in class - individual assignment
          setAssignmentMode('individual');
          setSelectedStudent(classStudents[0].id);
        }
      }
    }
  }, [selectedBooks, students]);

  // Get students for group assignment
  const getGroupStudents = () => {
    if (!selectedStudent || assignmentMode !== 'group') return [];
    
    const mainStudent = students?.find(s => s.id === selectedStudent);
    if (!mainStudent) return [];
    
    // Find all students in the same class
    return students?.filter(s => s.class_grade === mainStudent.class_grade) || [];
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;

    if (!selectedStudent) {
      alert('Please select a student first');
      return;
    }

    if (selectedBooks.length === 0) {
      alert('Please select at least one book');
      return;
    }

    if (!borrowedDate || !dueDate) {
      alert('Please set both borrowed and due dates');
      return;
    }

    if (new Date(dueDate) <= new Date(borrowedDate)) {
      alert('Due date must be after the borrowed date');
      return;
    }
    
    // Check if borrowing limit will be exceeded (simplified validation)
    const studentClass = selectedStudent ? classes?.find(c => c.id === students?.find(s => s.id === selectedStudent)?.class_id) : null;
    const maxBooksAllowed = studentClass?.max_books_allowed || 3;
    const currentBorrowings = (activeBorrowings || []).filter(b => b.student_id === selectedStudent).length;
    const remainingAllowedBooks = Math.max(0, maxBooksAllowed - currentBorrowings);
    
    if (selectedBooks.length > remainingAllowedBooks) {
      console.error(`Borrowing limit exceeded: trying to borrow ${selectedBooks.length} books but only ${remainingAllowedBooks} allowed`);
      alert(`Cannot issue ${selectedBooks.length} books. The student can only borrow ${remainingAllowedBooks} more book(s) based on their class level.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const borrowingRecords = [];
      
      if (assignmentMode === 'individual') {
        // Individual borrowing - one record per book
        for (const book of selectedBooks) {
          borrowingRecords.push({
            student_id: selectedStudent,
            book_id: book.book_id,
            book_copy_id: book.id,
            tracking_code: book.tracking_code,
            borrowed_date: borrowedDate,
            due_date: dueDate,
            condition_at_issue: book.condition || 'good',
            notes: notes.trim() || null,
            status: 'active',
            borrower_type: 'student'
          });
        }
      } else {
        // Group borrowing - create group borrowing records
        const groupStudents = getGroupStudents();
        
        for (const book of selectedBooks) {
          // Create individual borrowings for each student in the group
          for (const student of groupStudents) {
            borrowingRecords.push({
              student_id: student.id,
              book_id: book.book_id,
              book_copy_id: book.id,
              tracking_code: book.tracking_code,
              borrowed_date: borrowedDate,
              due_date: dueDate,
              condition_at_issue: book.condition || 'good',
              notes: notes.trim() || null,
              status: 'active',
              borrower_type: 'student'
            });
          }
        }
      }

      await onSubmit(borrowingRecords);
      
    } catch (error) {
      console.error('Error submitting borrowing:', error);
      alert('Failed to create borrowing records. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Get student name for display
  const getStudentDisplayName = (studentId: string) => {
    const student = students?.find(s => s.id === studentId);
    return student ? `${student.first_name} ${student.last_name} (${student.admission_number})` : 'Unknown Student';
  };

  // Check if form can be submitted
  const canSubmit = selectedStudent && 
                   selectedBooks.length > 0 && 
                   borrowedDate && 
                   dueDate && 
                   !isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Search and Book Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5" />
            Search Books by Tracking Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="search">Enter Tracking Code</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Start typing tracking code (e.g., ACC/001/24)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 font-mono"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Search Results */}
            {searchResults && searchResults.type !== 'none' && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="font-medium mb-3">Search Results</h3>
                
                {searchResults.type === 'exact' && searchResults.data && (
                  <div className="space-y-2">
                    <p className="text-sm text-green-600 font-medium">✓ Exact match found</p>
                    <div 
                      className="p-3 border rounded-lg bg-white hover:bg-blue-50 cursor-pointer"
                      onClick={() => handleSearchSelect(searchResults.data)}
                    >
                      <div className="font-medium">{searchResults.data.books?.title}</div>
                      <div className="text-sm text-gray-600">
                        Code: {searchResults.data.tracking_code} | Status: {searchResults.data.status}
                      </div>
                    </div>
                  </div>
                )}

                {searchResults.type === 'book_copies' && Array.isArray(searchResults.data) && (
                  <div className="space-y-2">
                    <p className="text-sm text-blue-600 font-medium">📚 Related book copies found</p>
                    {searchResults.data.slice(0, 5).map((copy: BookCopy) => (
                      <div 
                        key={copy.id}
                        className="p-3 border rounded-lg bg-white hover:bg-blue-50 cursor-pointer"
                        onClick={() => handleSearchSelect(copy)}
                      >
                        <div className="font-medium">{copy.books?.title}</div>
                        <div className="text-sm text-gray-600">
                          Code: {copy.tracking_code} | Status: {copy.status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.type === 'book_code' && searchResults.data && (
                  <div className="space-y-2">
                    <p className="text-sm text-blue-600 font-medium">📖 Books matching code found</p>
                    {Object.entries(searchResults.data).slice(0, 3).map(([bookId, bookData]: [string, any]) => (
                      <div key={bookId} className="p-3 border rounded-lg bg-white">
                        <div className="font-medium">{bookData.book?.title}</div>
                        <div className="text-sm text-gray-600 mb-2">
                          {bookData.totalCopies} copies available
                        </div>
                        <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                          {bookData.copies.slice(0, 3).map((copy: BookCopy) => (
                            <div 
                              key={copy.id}
                              className="p-2 bg-gray-50 rounded hover:bg-blue-50 cursor-pointer text-sm"
                              onClick={() => handleSearchSelect(copy)}
                            >
                              {copy.tracking_code} ({copy.status})
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isSearching && (
              <div className="text-center text-gray-500 py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                Searching...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Selected Books */}
      {selectedBooks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookMarked className="h-5 w-5" />
              Selected Books ({selectedBooks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedBooks.map((book) => (
                <div key={book.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex-1">
                    <div className="font-medium text-blue-900">{book.books?.title}</div>
                    <div className="text-sm text-blue-700">
                      Code: {book.tracking_code} | Author: {book.books?.author} | Condition: {book.condition}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSelectedBook(book.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student Assignment */}
      {selectedBooks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              Student Assignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Assignment Mode */}
              <div>
                <Label>Assignment Mode</Label>
                <Select value={assignmentMode} onValueChange={(value: 'individual' | 'group') => setAssignmentMode(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Individual Assignment
                      </div>
                    </SelectItem>
                    <SelectItem value="group">
                      <div className="flex items-center gap-2">
                        <Users2 className="w-4 w-4" />
                        Group Assignment (Same Class)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Student Selection */}
              <div>
                <Label>Select Student</Label>
                <Select value={selectedStudent || ''} onValueChange={setSelectedStudent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a student..." />
                  </SelectTrigger>
                  <SelectContent>
                    {students?.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.first_name} {student.last_name} ({student.admission_number}) - {student.class_grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Group Assignment Preview */}
              {assignmentMode === 'group' && selectedStudent && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                    <Users2 className="w-4 h-4" />
                    Group Assignment Preview
                  </h3>
                  <p className="text-sm text-green-700 mb-3">
                    Books will be assigned to all students in the same class:
                  </p>
                  <div className="space-y-1">
                    {getGroupStudents().map((student) => (
                      <div key={student.id} className="text-sm text-green-800">
                        • {student.first_name} {student.last_name} ({student.admission_number})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Individual Assignment Preview */}
              {assignmentMode === 'individual' && selectedStudent && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Individual Assignment
                  </h3>
                  <p className="text-sm text-blue-700">
                    Books will be assigned to: <strong>{getStudentDisplayName(selectedStudent)}</strong>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Borrowing Details */}
      {selectedStudent && selectedBooks.length > 0 && (
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
      )}

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
            `Issue ${selectedBooks.length} Book${selectedBooks.length !== 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </form>
  );
};