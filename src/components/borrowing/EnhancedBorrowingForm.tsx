
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Search, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBookCopies } from '@/hooks/useBookCopies';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useCreateSystemLog } from '@/hooks/useSystemLogs';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_grade?: string;
  status?: string;
  class_id?: string;
}

interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  available_copies: number;
  condition?: string;
  legacy_book_id?: number | null;
}

interface EnhancedBorrowingFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  books?: Book[];
  students?: Student[];
}

export const EnhancedBorrowingForm = ({ onSubmit, onCancel, books = [], students = [] }: EnhancedBorrowingFormProps) => {
  const { data: settings } = useSystemSettings();
  const [bookSearchTerm, setBookSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { data: bookCopies, isLoading: isLoadingBooks } = useBookCopies({ 
    searchTerm: bookSearchTerm,
    page: 1,
    pageSize: 100
  });
  
  // Debounce search to avoid too many requests
  useEffect(() => {
    const timer = setTimeout(() => {
      if (bookSearchTerm.trim() !== '') {
        setIsSearching(true);
      } else {
        setIsSearching(false);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [bookSearchTerm]);
  const createLog = useCreateSystemLog();
  
  const [formData, setFormData] = useState({
    student_id: '',
    book_id: '',
    book_copy_id: '',
    due_date: '',
    notes: '',
    condition_at_issue: 'good',
    fine_amount: 0
  });
  
  const [openStudentDropdown, setOpenStudentDropdown] = useState(false);
  const [openBookDropdown, setOpenBookDropdown] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [availableCopies, setAvailableCopies] = useState<any[]>([]);
  const [showInactiveWarning, setShowInactiveWarning] = useState(false);
  const [studentPage, setStudentPage] = useState(1);
  const [bookPage, setBookPage] = useState(1);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const itemsPerPage = 20;

  // Get default due date (14 days from now)
  const getDefaultDueDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().split('T')[0];
  };

  // Reset pagination when search terms change
  useEffect(() => {
    setStudentPage(1);
  }, [studentSearchTerm]);

  useEffect(() => {
    setBookPage(1);
  }, [bookSearchTerm]);

  // Filter available books
  const availableBooks = books.filter(book => book.available_copies > 0);

  // Filter students based on search
  const filteredStudents = students.filter(student => {
    if (!studentSearchTerm) return true;
    const searchLower = studentSearchTerm.toLowerCase();
    return (
      student.first_name.toLowerCase().includes(searchLower) ||
      student.last_name.toLowerCase().includes(searchLower) ||
      student.admission_number.toLowerCase().includes(searchLower)
    );
  });

  // Get unique books from book copies with proper type safety
  const filteredBooks = React.useMemo(() => {
    if (!bookCopies?.data) return [];
    
    const uniqueBooks = new Map<string, Book>();
    const copiesByBookId = new Map<string, any[]>();
    
    // First, group copies by book_id
    bookCopies.data.forEach(copy => {
      if (!copiesByBookId.has(copy.book_id)) {
        copiesByBookId.set(copy.book_id, []);
      }
      copiesByBookId.get(copy.book_id)?.push(copy);
    });
    
    // Then create unique book entries
    Array.from(copiesByBookId.entries()).forEach(([bookId, copies]) => {
      const firstCopy = copies[0];
      const bookData = (firstCopy as any).books || {};
      
      // Count available copies
      const availableCount = copies.filter(c => c.status === 'available').length;
      
      uniqueBooks.set(bookId, {
        id: bookId,
        title: bookData.title || 'Unknown Title',
        author: bookData.author || 'Unknown Author',
        isbn: bookData.isbn,
        available_copies: availableCount,
        condition: firstCopy.condition,
        legacy_book_id: bookData.legacy_book_id || firstCopy.legacy_book_id
      });
    });
    
    return Array.from(uniqueBooks.values());
  }, [bookCopies]);

  // Pagination for students
  const totalStudentPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startStudentIndex = (studentPage - 1) * itemsPerPage;
  const endStudentIndex = Math.min(startStudentIndex + itemsPerPage, filteredStudents.length);
  const paginatedStudents = filteredStudents.slice(startStudentIndex, endStudentIndex);

  // Pagination for books
  const totalBookPages = Math.ceil(filteredBooks.length / itemsPerPage);
  const startBookIndex = (bookPage - 1) * itemsPerPage;
  const endBookIndex = Math.min(startBookIndex + itemsPerPage, filteredBooks.length);
  const paginatedBooks = filteredBooks.slice(startBookIndex, endBookIndex);

  // Check student status and borrowing limits
  useEffect(() => {
    if (selectedStudent) {
      setShowInactiveWarning(selectedStudent.status === 'inactive');
      
      // Check borrowing limits based on class
      // This would require additional logic to check current borrowings
    }
  }, [selectedStudent]);

  // Load available copies when book is selected or search term changes
  useEffect(() => {
    if (!bookCopies?.data) return;
    
    if (selectedBook) {
      const copies = bookCopies.data.filter(copy => 
        copy.book_id === selectedBook.id && 
        copy.status === 'available'
      );
      setAvailableCopies(copies);
    } else if (bookSearchTerm) {
      // If searching, show all available copies from search results
      const copies = bookCopies.data.filter((copy: any) => copy.status === 'available');
      setAvailableCopies(copies);
    }
  }, [selectedBook, bookCopies, bookSearchTerm]);

  const handleStudentSelect = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    setSelectedStudent(student || null);
    setFormData({ ...formData, student_id: studentId });
    setOpenStudentDropdown(false);
    setStudentSearchTerm('');
  };

  const handleBookSelect = (bookId: string) => {
    const book = books.find(b => b.id === bookId);
    setSelectedBook(book || null);
    setFormData({ ...formData, book_id: bookId, book_copy_id: '' });
    setOpenBookDropdown(false);
    setBookSearchTerm('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (showInactiveWarning && !confirm('This student is inactive. Do you want to proceed with the borrowing?')) {
      return;
    }

    try {
      const borrowingData = {
        ...formData,
        due_date: formData.due_date || getDefaultDueDate(),
        borrowed_date: new Date().toISOString().split('T')[0],
        status: 'active'
      };
      
      await onSubmit(borrowingData);
      
      // Log the borrowing action
      await createLog.mutateAsync({
        action_type: 'book_issued',
        resource_type: 'borrowing',
        details: {
          student_name: `${selectedStudent?.first_name} ${selectedStudent?.last_name}`,
          student_admission: selectedStudent?.admission_number,
          book_title: selectedBook?.title,
          book_copy_code: availableCopies.find(c => c.id === formData.book_copy_id)?.book_code,
          due_date: formData.due_date || getDefaultDueDate()
        }
      });
      
    } catch (error) {
      console.error('Error creating borrowing:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Student Selection */}
      <div>
        <Label htmlFor="student">Student *</Label>
        <Popover open={openStudentDropdown} onOpenChange={setOpenStudentDropdown}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between"
            >
              {selectedStudent ? (
                <div className="flex items-center gap-2">
                  <span>{selectedStudent.first_name} {selectedStudent.last_name} - {selectedStudent.admission_number}</span>
                  {selectedStudent.status === 'inactive' && (
                    <Badge variant="destructive">Inactive</Badge>
                  )}
                </div>
              ) : (
                "Select a student"
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command>
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input
                  placeholder="Search by name or admission number..."
                  className="border-0 focus:ring-0"
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                />
              </div>
              <CommandList className="max-h-60">
                <CommandEmpty>No student found.</CommandEmpty>
                <CommandGroup>
                  {paginatedStudents.map((student) => (
                    <CommandItem
                      key={student.id}
                      value={student.id}
                      onSelect={() => handleStudentSelect(student.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          formData.student_id === student.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex items-center justify-between w-full">
                        <span>{student.first_name} {student.last_name} - {student.admission_number}</span>
                        {student.status === 'inactive' && (
                          <Badge variant="destructive" className="ml-2">Inactive</Badge>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                
                {/* Student Pagination Controls */}
                {filteredStudents.length > itemsPerPage && (
                  <div className="flex items-center justify-between border-t p-2 bg-gray-50">
                    <div className="text-xs text-gray-500">
                      Showing {startStudentIndex + 1}-{endStudentIndex} of {filteredStudents.length}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                        disabled={studentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs font-medium">
                        Page {studentPage} of {totalStudentPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setStudentPage(p => Math.min(totalStudentPages, p + 1))}
                        disabled={studentPage === totalStudentPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        
        {showInactiveWarning && (
          <Alert className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Warning: This student is currently inactive. Proceeding will issue a book to an inactive student.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Book Selection */}
      <div>
        <Label htmlFor="book">Book *</Label>
        <Popover open={openBookDropdown} onOpenChange={setOpenBookDropdown}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between"
            >
              {selectedBook ? 
                `${selectedBook.title} by ${selectedBook.author}` 
                : "Select a book"
              }
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command>
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input
                  placeholder="Search by title, author, ISBN, or legacy ID..."
                  className="border-0 focus:ring-0"
                  value={bookSearchTerm}
                  onChange={(e) => setBookSearchTerm(e.target.value)}
                />
              </div>
              <CommandList className="max-h-60">
                <CommandEmpty>
                {isLoadingBooks ? 'Searching...' : 'No books found. Try a different search term or check the legacy ID.'}
              </CommandEmpty>
                <CommandGroup>
                  {paginatedBooks.map((book) => (
                    <CommandItem
                      key={book.id}
                      value={book.id}
                      onSelect={() => handleBookSelect(book.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          formData.book_id === book.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="w-full">
                        <div className="flex justify-between">
                          <span className="font-medium">{book.title}</span>
                          {book.legacy_book_id && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Legacy ID: {book.legacy_book_id}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          <div>by {book.author}</div>
                          <div>
                            {book.available_copies} available • 
                            {book.isbn && `ISBN: ${book.isbn} • `}
                            Condition: {book.condition || 'Good'}
                          </div>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                
                {/* Book Pagination Controls */}
                {filteredBooks.length > itemsPerPage && (
                  <div className="flex items-center justify-between border-t p-2 bg-gray-50">
                    <div className="text-xs text-gray-500">
                      Showing {startBookIndex + 1}-{endBookIndex} of {filteredBooks.length} books
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setBookPage(p => Math.max(1, p - 1))}
                        disabled={bookPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs font-medium">
                        Page {bookPage} of {totalBookPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setBookPage(p => Math.min(totalBookPages, p + 1))}
                        disabled={bookPage === totalBookPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Book Copy Selection */}
      {availableCopies.length > 0 && (
        <div>
          <Label htmlFor="book_copy">Specific Copy</Label>
          <Select value={formData.book_copy_id} onValueChange={(value) => setFormData({ ...formData, book_copy_id: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select specific copy" />
            </SelectTrigger>
            <SelectContent>
              {availableCopies.map((copy) => (
                <SelectItem key={copy.id} value={copy.id}>
                  {copy.book_code} - {copy.condition}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Condition at Issue */}
      <div>
        <Label htmlFor="condition_at_issue">Book Condition at Issue</Label>
        <Select value={formData.condition_at_issue} onValueChange={(value) => setFormData({ ...formData, condition_at_issue: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="excellent">Excellent</SelectItem>
            <SelectItem value="good">Good</SelectItem>
            <SelectItem value="fair">Fair</SelectItem>
            <SelectItem value="damaged">Damaged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Due Date */}
      <div>
        <Label htmlFor="due_date">Due Date</Label>
        <Input
          id="due_date"
          type="date"
          value={formData.due_date || getDefaultDueDate()}
          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
        />
        <p className="text-sm text-gray-500 mt-1">Default: 14 days from today</p>
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          placeholder="Any additional notes about this borrowing..."
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!formData.student_id || !formData.book_id}>
          Issue Book
        </Button>
      </div>
    </form>
  );
};
