import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, ChevronsUpDown, Search, AlertTriangle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBooks } from '@/hooks/useBooks';
import { useStudents } from '@/hooks/useStudents';
import { useBookCopies } from '@/hooks/useBookCopies';
import { useBorrowingsArray } from '@/hooks/useBorrowings';

interface QuickBorrowingFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export const QuickBorrowingForm = ({ onSubmit, onCancel }: QuickBorrowingFormProps) => {
  const { data: books = [] } = useBooks();
  const { data: studentsResponse } = useStudents();
  const { data: bookCopiesData } = useBookCopies();
  const bookCopies = bookCopiesData?.data || [];
  
  // Extract students array safely
  const students = Array.isArray(studentsResponse?.students) ? studentsResponse.students : [];
  const { data: borrowings = [] } = useBorrowingsArray();
  
  const [formData, setFormData] = useState({
    student_id: '',
    book_id: '',
    book_copy_id: '',
    due_date: '',
    condition_at_issue: 'good'
  });
  
  const [bookSearchTerm, setBookSearchTerm] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [availableCopies, setAvailableCopies] = useState<any[]>([]);
  const [showBookPopover, setShowBookPopover] = useState(false);
  const [showStudentPopover, setShowStudentPopover] = useState(false);
  const [studentPage, setStudentPage] = useState(1);
  const [bookPage, setBookPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const itemsPerPage = 20;

  // Get default due date (14 days from now)
  const getDefaultDueDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().split('T')[0];
  };

  // Initialize due date on component mount
  useEffect(() => {
    if (!formData.due_date) {
      setFormData(prev => ({ ...prev, due_date: getDefaultDueDate() }));
    }
  }, []);

  // Reset pagination when search terms change
  useEffect(() => {
    setStudentPage(1);
  }, [studentSearchTerm]);

  useEffect(() => {
    setBookPage(1);
  }, [bookSearchTerm]);

  // Filter available books based on search term
  const filteredBooks = books.filter(book => {
    if (!bookSearchTerm) return book.available_copies > 0;
    
    const searchLower = bookSearchTerm.toLowerCase();
    return (
      book.available_copies > 0 && (
        book.title.toLowerCase().includes(searchLower) ||
        book.author.toLowerCase().includes(searchLower) ||
        book.book_code?.toLowerCase().includes(searchLower) ||
        book.isbn?.toLowerCase().includes(searchLower)
      )
    );
  });

  // Filter students based on search term
  const filteredStudents = students.filter(student => {
    if (!studentSearchTerm) return true;
    
    const searchLower = studentSearchTerm.toLowerCase();
    return (
      student.first_name.toLowerCase().includes(searchLower) ||
      student.last_name.toLowerCase().includes(searchLower) ||
      student.admission_number.toLowerCase().includes(searchLower)
    );
  });

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

  // Load available copies when book is selected
  useEffect(() => {
    if (selectedBook) {
      console.log('Loading available copies for book:', selectedBook.id);
      const copies = bookCopies.filter(copy => 
        copy.book_id === selectedBook.id && 
        copy.status === 'available'
      );
      console.log('Available copies found:', copies.length);
      setAvailableCopies(copies);
      
      // Auto-select first available copy
      if (copies.length > 0) {
        console.log('Auto-selecting first copy:', copies[0].id);
        setFormData(prev => ({ ...prev, book_copy_id: copies[0].id }));
      } else {
        console.log('No available copies found');
        setFormData(prev => ({ ...prev, book_copy_id: '' }));
      }
    }
  }, [selectedBook, bookCopies]);

  // Check if book might be stolen (overdue for more than 30 days)
  const checkStolenBooks = (bookId: string) => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    return (borrowings || []).filter(borrowing => 
      borrowing.book_id === bookId && 
      !borrowing.returned_date && 
      new Date(borrowing.due_date) < thirtyDaysAgo
    );
  };

  const handleBookSelect = (book: any) => {
    console.log('Book selected:', book.title, book.id);
    setSelectedBook(book);
    setFormData(prev => ({ ...prev, book_id: book.id, book_copy_id: '' }));
    setShowBookPopover(false);
    setBookSearchTerm('');
  };

  const handleStudentSelect = (student: any) => {
    console.log('Student selected:', student.first_name, student.last_name, student.id);
    setSelectedStudent(student);
    setFormData(prev => ({ ...prev, student_id: student.id }));
    setShowStudentPopover(false);
    setStudentSearchTerm('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submission started');
    console.log('Form data:', formData);
    console.log('Selected student:', selectedStudent);
    console.log('Selected book:', selectedBook);
    console.log('Available copies:', availableCopies.length);

    // Validate required fields
    if (!formData.student_id) {
      console.error('No student selected');
      return;
    }
    
    if (!formData.book_id) {
      console.error('No book selected');
      return;
    }
    
    if (!formData.book_copy_id) {
      console.error('No book copy selected');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const borrowingData = {
        student_id: formData.student_id,
        book_id: formData.book_id,
        book_copy_id: formData.book_copy_id,
        due_date: formData.due_date || getDefaultDueDate(),
        borrowed_date: new Date().toISOString().split('T')[0],
        status: 'active',
        condition_at_issue: formData.condition_at_issue
      };
      
      console.log('Submitting borrowing data:', borrowingData);
      await onSubmit(borrowingData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stolenBooks = selectedBook ? checkStolenBooks(selectedBook.id) : [];

  // Check if form is valid
  const isFormValid = formData.student_id && formData.book_id && formData.book_copy_id && !isSubmitting;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Student Selection */}
        <div className="space-y-2">
          <Label>Select Student *</Label>
          <Popover open={showStudentPopover} onOpenChange={setShowStudentPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between h-auto min-h-[40px] p-3"
              >
                {selectedStudent ? (
                  <div className="flex items-center gap-2">
                    <div className="text-left">
                      <div className="font-medium">{selectedStudent.first_name} {selectedStudent.last_name}</div>
                      <div className="text-sm text-gray-500">{selectedStudent.admission_number} • {selectedStudent.class_grade}</div>
                    </div>
                    {selectedStudent.status === 'inactive' && (
                      <Badge variant="destructive">Inactive</Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-500">Search and select a student...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
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
                  <CommandEmpty>No students found.</CommandEmpty>
                  <CommandGroup>
                    {paginatedStudents.map((student) => (
                      <CommandItem
                        key={student.id}
                        onSelect={() => handleStudentSelect(student)}
                        className="flex items-center justify-between p-3"
                      >
                        <div className="flex items-center">
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.student_id === student.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div>
                            <div className="font-medium">{student.first_name} {student.last_name}</div>
                            <div className="text-sm text-gray-500">{student.admission_number} • {student.class_grade}</div>
                          </div>
                        </div>
                        {student.status === 'inactive' && (
                          <Badge variant="destructive" className="ml-2">Inactive</Badge>
                        )}
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
        </div>

        {/* Book Selection */}
        <div className="space-y-2">
          <Label>Select Book *</Label>
          <Popover open={showBookPopover} onOpenChange={setShowBookPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between h-auto min-h-[40px] p-3"
              >
                {selectedBook ? (
                  <div className="text-left">
                    <div className="font-medium">{selectedBook.title}</div>
                    <div className="text-sm text-gray-500">
                      {selectedBook.author} • {selectedBook.book_code} • {selectedBook.available_copies} available
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-500">Search books by title, author, or code...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[500px] p-0">
              <Command>
                <div className="flex items-center border-b px-3">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input
                    placeholder="Search by title, author, ISBN, or book code (e.g., KSU/002/20)..."
                    className="border-0 focus:ring-0"
                    value={bookSearchTerm}
                    onChange={(e) => setBookSearchTerm(e.target.value)}
                  />
                </div>
                <CommandList className="max-h-60">
                  <CommandEmpty>No available books found.</CommandEmpty>
                  <CommandGroup>
                    {paginatedBooks.map((book) => {
                      const stolen = checkStolenBooks(book.id);
                      return (
                        <CommandItem
                          key={book.id}
                          onSelect={() => handleBookSelect(book)}
                          className="flex items-center justify-between p-3"
                        >
                          <div className="flex items-center">
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.book_id === book.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div>
                              <div className="font-medium">{book.title}</div>
                              <div className="text-sm text-gray-500">
                                {book.author} • {book.book_code} • ISBN: {book.isbn || 'N/A'}
                              </div>
                              <div className="text-xs text-blue-600">
                                {book.available_copies} copies available
                              </div>
                            </div>
                          </div>
                          {stolen.length > 0 && (
                            <Badge variant="destructive" className="ml-2">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {stolen.length} Possibly Stolen
                            </Badge>
                          )}
                        </CommandItem>
                      );
                    })}
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
      </div>

      {/* Specific Copy Selection */}
      {availableCopies.length > 0 && (
        <div>
          <Label>Select Specific Copy *</Label>
          <Select 
            value={formData.book_copy_id} 
            onValueChange={(value) => {
              console.log('Copy selected:', value);
              setFormData(prev => ({ ...prev, book_copy_id: value }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a specific copy" />
            </SelectTrigger>
            <SelectContent>
              {availableCopies.map((copy) => (
                <SelectItem key={copy.id} value={copy.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{copy.tracking_code || copy.book_code || `Copy ${copy.copy_number}`}</span>
                    <Badge variant={copy.condition === 'excellent' ? 'default' : 'secondary'}>
                      {copy.condition}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            {availableCopies.length} cop{availableCopies.length === 1 ? 'y' : 'ies'} available
          </p>
        </div>
      )}

      {/* Show message if no copies available */}
      {selectedBook && availableCopies.length === 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No available copies found for "{selectedBook.title}". All copies may be currently borrowed.
          </AlertDescription>
        </Alert>
      )}

      {/* Alerts */}
      {selectedStudent?.status === 'inactive' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Warning: This student is inactive. Please verify before proceeding.
          </AlertDescription>
        </Alert>
      )}

      {stolenBooks.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Alert: {stolenBooks.length} cop{stolenBooks.length === 1 ? 'y' : 'ies'} of this book {stolenBooks.length === 1 ? 'is' : 'are'} overdue by more than 30 days and may be stolen.
          </AlertDescription>
        </Alert>
      )}

      {/* Form Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Due Date *</Label>
          <Input
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
            required
          />
          <p className="text-xs text-gray-500 mt-1">Default: 14 days from today</p>
        </div>

        <div>
          <Label>Condition at Issue</Label>
          <Select 
            value={formData.condition_at_issue} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, condition_at_issue: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="excellent">Excellent</SelectItem>
              <SelectItem value="good">Good</SelectItem>
              <SelectItem value="fair">Fair</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Debug Info (remove in production) */}
      <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
        <p>Debug: Student ID: {formData.student_id || 'None'}</p>
        <p>Debug: Book ID: {formData.book_id || 'None'}</p>
        <p>Debug: Copy ID: {formData.book_copy_id || 'None'}</p>
        <p>Debug: Available Copies: {availableCopies.length}</p>
        <p>Debug: Form Valid: {isFormValid ? 'Yes' : 'No'}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={!isFormValid}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isSubmitting ? (
            <>
              <Clock className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Clock className="w-4 h-4 mr-2" />
              Issue Book
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
