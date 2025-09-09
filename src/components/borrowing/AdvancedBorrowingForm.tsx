import React, { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  BookOpen, 
  User, 
  Calendar, 
  Search, 
  ChevronsUpDown, 
  Check, 
  X, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Hash,
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBooks } from '@/hooks/useBooks';
import { useStudents } from '@/hooks/useStudents';
import { useBookCopies } from '@/hooks/useBookCopies';
import { useClasses } from '@/hooks/useClasses';
import { BookCopyInfo } from '@/components/ui/book-copy-info';
import { useDebounce } from '@/hooks/useDebounce';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_grade?: string;
  class_id?: string;
  status?: string;
}

interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  book_code?: string;
  available_copies: number;
  condition?: string;
  categories?: {
    id: string;
    name: string;
  };
}

interface BookCopy {
  id: string;
  book_id: string;
  copy_number: number;
  book_code: string;
  tracking_code?: string;
  condition: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

interface Class {
  id: string;
  class_name: string;
  max_books_allowed?: number;
}

interface AdvancedBorrowingFormProps {
  onSubmit: (data: any[]) => void;
  onCancel: () => void;
}

export const AdvancedBorrowingForm = ({ onSubmit, onCancel }: AdvancedBorrowingFormProps) => {
  const { data: books = [] } = useBooks();
  
  const [studentPage, setStudentPage] = useState(1);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [debouncedStudentSearch] = useDebounce(studentSearchTerm, 300);
  
  const { data: studentsData } = useStudents({
    page: studentPage,
    pageSize: 20,
    searchTerm: debouncedStudentSearch
  });
  const { data: bookCopiesData } = useBookCopies();
  const bookCopies = bookCopiesData?.data || [];
  const { data: classes = [] } = useClasses();

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedBooks, setSelectedBooks] = useState<(Book & { quantity: number; selectedCopyId?: string })[]>([]);
  const [bookSearchTerm, setBookSearchTerm] = useState('');
  const [openStudentPopover, setOpenStudentPopover] = useState(false);
  const [openBookPopover, setOpenBookPopover] = useState(false);
  const [showInactiveWarning, setShowInactiveWarning] = useState(false);
  const [bookPage, setBookPage] = useState(1);
  const [selectedBooksPage, setSelectedBooksPage] = useState(1);
  const [bookCodePages, setBookCodePages] = useState<{[bookId: string]: number}>({});
  const [openBookCodePopovers, setOpenBookCodePopovers] = useState<{[bookId: string]: boolean}>({});
  const [bookCodeSearchTerms, setBookCodeSearchTerms] = useState<{[bookId: string]: string}>({});
  const [bookCodeYearFilters, setBookCodeYearFilters] = useState<{[bookId: string]: string}>({});
  const [bookCodeConditionFilters, setBookCodeConditionFilters] = useState<{[bookId: string]: string}>({});
  const itemsPerPage = 20;
  const selectedBooksPerPage = 3;
  const bookCodeItemsPerPage = 8;
  
  const [formData, setFormData] = useState({
    due_date: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
    notes: '',
    condition_at_issue: 'good'
  });

  const studentClass = selectedStudent?.class_id 
    ? classes.find(cls => cls.id === selectedStudent.class_id)
    : null;
  
  const maxBooksAllowed = studentClass?.max_books_allowed || 3;
  const currentBooksCount = selectedBooks.reduce((sum, book) => sum + book.quantity, 0);
  const availableBooks = books.filter(book => book.available_copies > 0);

  const students = studentsData?.students || [];
  const totalStudentPages = studentsData?.totalPages || 1;

  // Reset pagination when search terms change
  useEffect(() => {
    setStudentPage(1);
  }, [studentSearchTerm]);

  useEffect(() => {
    setBookPage(1);
  }, [bookSearchTerm]);

  // Reset book code pagination when filters change
  useEffect(() => {
    Object.keys(bookCodeSearchTerms).forEach(bookId => {
      setBookCodePages(prev => ({ ...prev, [bookId]: 1 }));
    });
  }, [bookCodeSearchTerms]);

  useEffect(() => {
    Object.keys(bookCodeYearFilters).forEach(bookId => {
      setBookCodePages(prev => ({ ...prev, [bookId]: 1 }));
    });
  }, [bookCodeYearFilters]);

  useEffect(() => {
    Object.keys(bookCodeConditionFilters).forEach(bookId => {
      setBookCodePages(prev => ({ ...prev, [bookId]: 1 }));
    });
  }, [bookCodeConditionFilters]);

  const filteredBooks = availableBooks.filter(book => {
    if (!bookSearchTerm) return true;
    const searchLower = bookSearchTerm.toLowerCase();
    return (
      book.title.toLowerCase().includes(searchLower) ||
      book.author.toLowerCase().includes(searchLower) ||
      book.isbn?.toLowerCase().includes(searchLower) ||
      book.book_code?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination for books
  const totalBookPages = Math.ceil(filteredBooks.length / itemsPerPage);
  const startBookIndex = (bookPage - 1) * itemsPerPage;
  const endBookIndex = Math.min(startBookIndex + itemsPerPage, filteredBooks.length);
  const paginatedBooks = filteredBooks.slice(startBookIndex, endBookIndex);

  // Pagination for selected books
  const totalSelectedBooksPages = Math.ceil(selectedBooks.length / selectedBooksPerPage);
  const startSelectedBooksIndex = (selectedBooksPage - 1) * selectedBooksPerPage;
  const endSelectedBooksIndex = Math.min(startSelectedBooksIndex + selectedBooksPerPage, selectedBooks.length);
  const paginatedSelectedBooks = selectedBooks.slice(startSelectedBooksIndex, endSelectedBooksIndex);

  useEffect(() => {
    setShowInactiveWarning(selectedStudent?.status === 'inactive');
  }, [selectedStudent]);

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setOpenStudentPopover(false);
    setStudentSearchTerm('');
  };

  const handleBookSelect = (book: Book) => {
    const existingBook = selectedBooks.find(b => b.id === book.id);
    if (existingBook) {
      return;
    } else {
      if (currentBooksCount < maxBooksAllowed) {
        setSelectedBooks(books => [...books, { ...book, quantity: 1 }]);
        
        // Reset pagination, search, and filters for this book's codes
        setBookCodePages(prev => ({ ...prev, [book.id]: 1 }));
        setBookCodeSearchTerms(prev => ({ ...prev, [book.id]: '' }));
        setBookCodeYearFilters(prev => ({ ...prev, [book.id]: 'all' }));
        setBookCodeConditionFilters(prev => ({ ...prev, [book.id]: 'all' }));
      }
    }
    setOpenBookPopover(false);
    setBookSearchTerm('');
  };

  const handleRemoveBook = (bookId: string) => {
    setSelectedBooks(books => books.filter(b => b.id !== bookId));
  };

  const handleBookCodeSelect = (bookId: string, copyId: string) => {
    // Ensure we have the correct book copy regardless of which page it's on
    const bookCopy = bookCopies.find(copy => copy.id === copyId);
    
    if (bookCopy) {
      setSelectedBooks(books => 
        books.map(book => 
          book.id === bookId 
            ? { ...book, selectedCopyId: copyId }
            : book
        )
      );
      // Close the popover after selection
      setOpenBookCodePopovers(prev => ({ ...prev, [bookId]: false }));
      
      // Add logging to verify selection is working
      console.log(`Selected book copy: ${bookCopy.tracking_code || `${bookCopy.book_code}/${bookCopy.copy_number}`}`);
    } else {
      console.error(`Could not find book copy with ID: ${copyId}`);
    }
  };

  const toggleBookCodePopover = (bookId: string) => {
    setOpenBookCodePopovers(prev => ({ ...prev, [bookId]: !prev[bookId] }));
  };

  // Filter book codes based on search term, year, and condition
  const getFilteredBookCodes = (bookId: string, availableCopies: BookCopy[]) => {
    const searchTerm = bookCodeSearchTerms[bookId]?.toLowerCase() || '';
    const yearFilter = bookCodeYearFilters[bookId] || '';
    const conditionFilter = bookCodeConditionFilters[bookId] || '';

    return availableCopies.filter(copy => {
      const codeText = (copy.tracking_code || `${copy.book_code}/${copy.copy_number}`).toLowerCase();
      const copyYear = copy.created_at ? new Date(copy.created_at).getFullYear().toString() : '';
      
      const matchesSearch = !searchTerm || 
        codeText.includes(searchTerm) ||
        copy.copy_number.toString().includes(searchTerm);
      
      const matchesYear = !yearFilter || yearFilter === 'all' || copyYear === yearFilter;
      const matchesCondition = !conditionFilter || conditionFilter === 'all' || copy.condition === conditionFilter;
      
      return matchesSearch && matchesYear && matchesCondition;
    });
  };

  // Get unique years from book copies for filtering
  const getAvailableYears = (availableCopies: BookCopy[]) => {
    const years = availableCopies
      .map(copy => copy.created_at ? new Date(copy.created_at).getFullYear().toString() : '')
      .filter(year => year !== '')
      .filter((year, index, arr) => arr.indexOf(year) === index)
      .sort((a, b) => parseInt(b) - parseInt(a));
    return years;
  };

  // Get unique conditions from book copies for filtering
  const getAvailableConditions = (availableCopies: BookCopy[]) => {
    const conditions = availableCopies
      .map(copy => copy.condition)
      .filter((condition, index, arr) => arr.indexOf(condition) === index)
      .sort();
    return conditions;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (showInactiveWarning && !confirm('This student is inactive. Do you want to proceed with the borrowing?')) {
      return;
    }

    const borrowings: any[] = [];
    
    selectedBooks.forEach(book => {
      const availableCopies = bookCopies.filter(copy => 
        copy.book_id === book.id && 
        copy.status === 'available'
      );
      
      // Use selected copy ID if available, otherwise use first available copy
      const copyToUse = book.selectedCopyId 
        ? availableCopies.find(copy => copy.id === book.selectedCopyId)
        : availableCopies[0];
      
      if (copyToUse) {
        borrowings.push({
          student_id: selectedStudent!.id,
          book_id: book.id,
          book_copy_id: copyToUse.id,
          due_date: formData.due_date,
          notes: formData.notes,
          condition_at_issue: formData.condition_at_issue,
          borrowed_date: new Date().toISOString().split('T')[0],
          status: 'active'
        });
      }
    });

    onSubmit(borrowings);
  };

  const isFormValid = selectedStudent && selectedBooks.length > 0 && formData.due_date;
  const isAtLimit = currentBooksCount >= maxBooksAllowed;

  return (
    <div className="space-y-6">
      <BookCopyInfo variant="compact" />
      <div className="text-center border-b pb-4">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BookOpen className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Issue Multiple Books</h2>
        </div>
        <p className="text-gray-600">Select a student and books to create new borrowing records</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-2 hover:border-blue-200 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-blue-600" />
              Student Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Select Student *</Label>
              <Popover open={openStudentPopover} onOpenChange={setOpenStudentPopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openStudentPopover}
                    className="w-full justify-between"
                  >
                    {selectedStudent ? (
                      <>
                        <User className="mr-2 h-4 w-4" />
                        {selectedStudent.first_name} {selectedStudent.last_name}
                        <Badge className="ml-2" variant="outline">
                          {selectedStudent.admission_number}
                        </Badge>
                      </>
                    ) : (
                      <>
                        <User className="mr-2 h-4 w-4" />
                        Select student...
                      </>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput 
                      placeholder="Search students..." 
                      value={studentSearchTerm}
                      onValueChange={setStudentSearchTerm}
                    />
                    <CommandList>
                      <CommandEmpty>No students found.</CommandEmpty>
                      <CommandGroup>
                        {students
                          .filter(student => student.status === 'active')
                          .map((student) => (
                            <CommandItem
                              key={student.id}
                              value={`${student.first_name} ${student.last_name} ${student.admission_number}`}
                              onSelect={() => {
                                setSelectedStudent(student);
                                setOpenStudentPopover(false);
                                setStudentSearchTerm('');
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedStudent?.id === student.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex-1">
                                <div className="flex items-center">
                                  {student.first_name} {student.last_name}
                                  <Badge className="ml-2" variant="outline">
                                    {student.admission_number}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Class: {student.class_grade}
                                </p>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                      {totalStudentPages > 1 && (
                        <div className="flex items-center justify-center p-2 border-t">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                              disabled={studentPage === 1}
                            >
                              Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              Page {studentPage} of {totalStudentPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setStudentPage(p => Math.min(totalStudentPages, p + 1))}
                              disabled={studentPage === totalStudentPages}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {showInactiveWarning && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <strong>Warning:</strong> This student is currently inactive. Proceed with caution.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 hover:border-green-200 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-green-600" />
                Professional Book Selection
              </div>
              <Badge variant="outline" className="font-medium">
                {currentBooksCount} / {maxBooksAllowed} selected
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {selectedBooks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Selected Books (One Copy Per Book)</Label>
                  {selectedBooks.length > selectedBooksPerPage && (
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-500">
                        Showing {startSelectedBooksIndex + 1}-{endSelectedBooksIndex} of {selectedBooks.length}
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setSelectedBooksPage(p => Math.max(1, p - 1))}
                          disabled={selectedBooksPage === 1}
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <span className="text-xs font-medium px-2">
                          {selectedBooksPage}/{totalSelectedBooksPages}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setSelectedBooksPage(p => Math.min(totalSelectedBooksPages, p + 1))}
                          disabled={selectedBooksPage === totalSelectedBooksPages}
                        >
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <ScrollArea className="max-h-80 border rounded-md p-3 bg-gray-50">
                  <div className="space-y-3">
                    {paginatedSelectedBooks.map((book) => {
                      const availableCopies = bookCopies.filter(copy => 
                        copy.book_id === book.id && copy.status === 'available'
                      );
                      const filteredCopies = getFilteredBookCodes(book.id, availableCopies);
                      const selectedCopy = book.selectedCopyId 
                        ? availableCopies.find(copy => copy.id === book.selectedCopyId) 
                        : filteredCopies[0];
                      
                      // Ensure we have valid pagination values
                      const bookCodePage = bookCodePages[book.id] || 1;
                      const totalBookCodePages = Math.max(1, Math.ceil(filteredCopies.length / bookCodeItemsPerPage));
                      
                      // Ensure the current page doesn't exceed the total pages (in case filters reduce the count)
                      const currentBookCodePage = Math.min(bookCodePage, totalBookCodePages);
                      if (bookCodePage !== currentBookCodePage) {
                        // Update page if it's out of bounds
                        setBookCodePages(prev => ({ ...prev, [book.id]: currentBookCodePage }));
                      }

                      const startBookCodeIndex = (currentBookCodePage - 1) * bookCodeItemsPerPage;
                      const endBookCodeIndex = Math.min(startBookCodeIndex + bookCodeItemsPerPage, filteredCopies.length);
                      const paginatedBookCodes = filteredCopies.slice(startBookCodeIndex, endBookCodeIndex);
                      
                      // Get filter options
                      const availableYears = getAvailableYears(availableCopies);
                      const availableConditions = getAvailableConditions(availableCopies);
                      
                      return (
                        <div key={book.id} className="flex items-center justify-between bg-white rounded-lg p-4 border shadow-sm">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 truncate">{book.title}</div>
                            <div className="text-sm text-gray-600 truncate mb-2">{book.author}</div>
                            
                            <div className="flex items-center gap-2 mb-3">
                              {book.book_code && (
                                <Badge variant="outline" className="text-xs font-mono bg-blue-50 text-blue-700">
                                  Book: {book.book_code}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">
                                {book.available_copies} copies available
                              </Badge>
                            </div>
                            
                            {/* Book Code Selection */}
                            <div className="mb-3">
                              <div className="flex items-center justify-between mb-1">
                                <Label className="text-xs font-medium text-gray-600">Select Book Code</Label>
                                {(bookCodeSearchTerms[book.id] || (bookCodeYearFilters[book.id] && bookCodeYearFilters[book.id] !== 'all') || (bookCodeConditionFilters[book.id] && bookCodeConditionFilters[book.id] !== 'all')) && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                    Filtered ({filteredCopies.length}/{availableCopies.length})
                                  </Badge>
                                )}
                              </div>
                              <Popover 
                                open={openBookCodePopovers[book.id] || false} 
                                onOpenChange={(open) => setOpenBookCodePopovers(prev => ({ ...prev, [book.id]: open }))}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className="w-full justify-between h-8 text-xs"
                                  >
                                    {selectedCopy ? (
                                      <div className="flex items-center gap-1">
                                        <span className="font-bold">Copy #{selectedCopy.copy_number}</span>
                                        <span className="text-muted-foreground font-mono text-xs ml-1">
                                          ({selectedCopy.tracking_code})
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-gray-500">Choose book copy...</span>
                                    )}
                                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-96 p-0">
                                  <Command>
                                    <div className="p-3 border-b bg-gray-50">
                                      <div className="text-xs font-medium text-gray-600 mb-2">Search & Filter Book Codes</div>
                                      
                                      {/* Search Input */}
                                      <div className="mb-2">
                                        <div className="flex items-center border rounded-md px-2 py-1 bg-white">
                                          <Search className="w-3 h-3 text-gray-400 mr-1" />
                                          <Input
                                            placeholder="Search by code or number..."
                                            className="border-0 p-0 h-6 text-xs focus:ring-0"
                                            value={bookCodeSearchTerms[book.id] || ''}
                                            onChange={(e) => setBookCodeSearchTerms(prev => ({ 
                                              ...prev, 
                                              [book.id]: e.target.value 
                                            }))}
                                          />
                                        </div>
                                      </div>

                                      {/* Filter Controls */}
                                      <div className="grid grid-cols-2 gap-2">
                                        {/* Year Filter */}
                                        <div>
                                          <Label className="text-xs text-gray-600">Year</Label>
                                          <Select 
                                            value={bookCodeYearFilters[book.id] || 'all'}
                                            onValueChange={(value) => setBookCodeYearFilters(prev => ({ 
                                              ...prev, 
                                              [book.id]: value 
                                            }))}
                                          >
                                            <SelectTrigger className="h-6 text-xs">
                                              <SelectValue placeholder="Any" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="all">All Years</SelectItem>
                                              {availableYears.map(year => (
                                                <SelectItem key={year} value={year}>{year}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        {/* Condition Filter */}
                                        <div>
                                          <Label className="text-xs text-gray-600">Condition</Label>
                                          <Select 
                                            value={bookCodeConditionFilters[book.id] || 'all'}
                                            onValueChange={(value) => setBookCodeConditionFilters(prev => ({ 
                                              ...prev, 
                                              [book.id]: value 
                                            }))}
                                          >
                                            <SelectTrigger className="h-6 text-xs">
                                              <SelectValue placeholder="Any" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="all">All Conditions</SelectItem>
                                              {availableConditions.map(condition => (
                                                <SelectItem key={condition} value={condition}>
                                                  {condition.charAt(0).toUpperCase() + condition.slice(1)}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>

                                      {/* Clear Filters */}
                                      {(bookCodeSearchTerms[book.id] || (bookCodeYearFilters[book.id] && bookCodeYearFilters[book.id] !== 'all') || (bookCodeConditionFilters[book.id] && bookCodeConditionFilters[book.id] !== 'all')) && (
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-6 text-xs mt-2 w-full"
                                          onClick={() => {
                                            setBookCodeSearchTerms(prev => ({ ...prev, [book.id]: '' }));
                                            setBookCodeYearFilters(prev => ({ ...prev, [book.id]: 'all' }));
                                            setBookCodeConditionFilters(prev => ({ ...prev, [book.id]: 'all' }));
                                            setBookCodePages(prev => ({ ...prev, [book.id]: 1 }));
                                          }}
                                        >
                                          Clear Filters
                                        </Button>
                                      )}
                                    </div>
                                    
                                    <CommandList className="max-h-48">
                                      <CommandEmpty>
                                        <div className="text-center py-4">
                                          <div className="text-xs text-gray-500">No book codes found</div>
                                          <div className="text-xs text-gray-400 mt-1">
                                            {filteredCopies.length === 0 && availableCopies.length > 0 
                                              ? 'Try adjusting your filters' 
                                              : 'No copies available for this book'
                                            }
                                          </div>
                                        </div>
                                      </CommandEmpty>
                                      <CommandGroup>
                                        {paginatedBookCodes.map((copy) => (
                                          <CommandItem
                                            key={copy.id}
                                            onSelect={() => {
                                              // Use the complete copy data when selecting
                                              const fullCopyData = bookCopies.find(c => c.id === copy.id);
                                              if (fullCopyData) {
                                                handleBookCodeSelect(book.id, fullCopyData.id);
                                              } else {
                                                handleBookCodeSelect(book.id, copy.id);
                                              }
                                            }}
                                            className="flex items-center justify-between p-2 cursor-pointer"
                                          >
                                            <div className="flex items-center gap-2">
                                              <Check
                                                className={cn(
                                                  "h-3 w-3",
                                                  selectedCopy?.id === copy.id ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                  <Badge className="bg-blue-100 text-blue-800 font-bold text-xs">
                                                    Copy #{copy.copy_number}
                                                  </Badge>
                                                  <Badge variant="outline" className="text-xs">
                                                    {copy.condition || 'Good'}
                                                  </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground font-mono">
                                                  ID: {copy.tracking_code || `${copy.book_code}/${copy.copy_number}`}
                                                </div>
                                                {copy.created_at && (
                                                  <div className="text-xs text-gray-500">
                                                    Added: {new Date(copy.created_at).getFullYear()}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                      
                                      {/* Book Code Pagination Controls */}
                                      {filteredCopies.length > bookCodeItemsPerPage && (
                                        <div className="flex items-center justify-between border-t p-2 bg-gray-50">
                                          <div className="text-xs text-gray-500">
                                            Showing {startBookCodeIndex + 1}-{endBookCodeIndex} of {filteredCopies.length}
                                            {filteredCopies.length < availableCopies.length && (
                                              <span className="text-blue-600"> (filtered from {availableCopies.length})</span>
                                            )}
                                          </div>
                                          <div className="flex items-center space-x-1">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="icon"
                                              className="h-5 w-5"
                                              onClick={() => setBookCodePages(prev => ({ 
                                                ...prev, 
                                                [book.id]: Math.max(1, bookCodePage - 1) 
                                              }))}
                                              disabled={bookCodePage === 1}
                                            >
                                              <ChevronLeft className="h-3 w-3" />
                                            </Button>
                                            <span className="text-xs font-medium px-1">
                                              {bookCodePage}/{totalBookCodePages}
                                            </span>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="icon"
                                              className="h-5 w-5"
                                              onClick={() => setBookCodePages(prev => ({ 
                                                ...prev, 
                                                [book.id]: Math.min(totalBookCodePages, bookCodePage + 1) 
                                              }))}
                                              disabled={bookCodePage === totalBookCodePages}
                                            >
                                              <ChevronRight className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                            
                            {selectedCopy && (
                              <div className="bg-gray-50 rounded-md p-2 border-l-4 border-blue-500">
                                <div className="text-xs text-gray-600 mb-1">Selected copy details:</div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className="bg-blue-100 text-blue-800 font-bold text-xs">
                                    Copy #{selectedCopy.copy_number}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    Condition: {selectedCopy.condition || 'Good'}
                                  </Badge>
                                  {selectedCopy.created_at && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                      Added: {new Date(selectedCopy.created_at).getFullYear()}
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                    System ID: {selectedCopy.tracking_code}
                                  </Badge>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 ml-4">
                            <div className="text-center">
                              <div className="text-xs text-gray-500 mb-1">Quantity</div>
                              <Badge className="bg-blue-100 text-blue-800 font-semibold">1</Badge>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveBook(book.id)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium">Add Books</Label>
              <Popover open={openBookPopover} onOpenChange={setOpenBookPopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between h-auto min-h-[48px] p-3 mt-1"
                    disabled={isAtLimit}
                  >
                    {isAtLimit ? (
                      <div className="flex items-center gap-2 text-gray-500">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Maximum books limit reached</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Search className="w-4 h-4" />
                        <span>Search and select books to add...</span>
                      </div>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <div className="flex items-center border-b px-3">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <Input
                        placeholder="Search by title, author, ISBN, or book code..."
                        className="border-0 focus:ring-0"
                        value={bookSearchTerm}
                        onChange={(e) => setBookSearchTerm(e.target.value)}
                      />
                    </div>
                    <CommandList className="max-h-80">
                      <CommandEmpty>No available books found.</CommandEmpty>
                      <CommandGroup>
                        {paginatedBooks.map((book) => {
                          const isSelected = selectedBooks.find(b => b.id === book.id);
                          const canSelect = !isSelected && currentBooksCount < maxBooksAllowed;
                          
                          return (
                            <CommandItem
                              key={book.id}
                              onSelect={() => canSelect && handleBookSelect(book)}
                              className={cn(
                                "flex items-center justify-between p-4 cursor-pointer border-b border-gray-100 last:border-b-0",
                                isSelected && "bg-blue-50 border-blue-200",
                                !canSelect && "opacity-50 cursor-not-allowed"
                              )}
                              disabled={!canSelect}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="flex-shrink-0">
                                  {isSelected ? (
                                    <CheckCircle className="h-5 w-5 text-blue-600" />
                                  ) : (
                                    <div className="h-5 w-5 border-2 border-gray-300 rounded-full" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-gray-900 truncate">{book.title}</div>
                                  <div className="text-sm text-gray-600 truncate mb-2">
                                    by {book.author} {book.isbn && `• ISBN: ${book.isbn}`}
                                  </div>
                                  
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                      {book.available_copies} copies available
                                    </Badge>
                                    {book.book_code && (
                                      <Badge variant="secondary" className="text-xs font-mono bg-blue-50 text-blue-700">
                                        Book: {book.book_code}
                                      </Badge>                                    )}
                                    {book.categories && (
                                      <Badge variant="secondary" className="text-xs">
                                        {book.categories.name}
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {isSelected && (
                                    <div className="bg-blue-50 rounded-md p-2 border border-blue-200">
                                      <div className="text-xs text-blue-800 font-medium">✓ Selected for issuing</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex-shrink-0 ml-3">
                                {isSelected ? (
                                  <Badge className="bg-blue-600 text-white font-medium">
                                    SELECTED
                                  </Badge>
                                ) : canSelect ? (
                                  <Badge variant="outline" className="text-green-600 border-green-600">
                                    Available
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-gray-500">
                                    Limit Reached
                                  </Badge>
                                )}
                              </div>
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

            {isAtLimit && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <strong>Limit Reached:</strong> This student has reached their maximum borrowing limit of {maxBooksAllowed} books.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 hover:border-purple-200 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
              Borrowing Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Due Date *</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Default: 14 days from today</p>
              </div>

              <div>
                <Label className="text-sm font-medium">Condition at Issue</Label>
                <Select 
                  value={formData.condition_at_issue} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, condition_at_issue: value }))}
                >
                  <SelectTrigger className="mt-1">
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

              <div className="md:col-span-1">
                <Label className="text-sm font-medium">Issue Date</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md border">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-gray-600" />
                    <span className="font-medium">{format(new Date(), 'MMM dd, yyyy')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Label className="text-sm font-medium">Notes (Optional)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any special notes or conditions for this borrowing..."
                rows={3}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {selectedStudent && selectedBooks.length > 0 && (
          <Card className="bg-gray-50 border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Borrowing Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Student</h4>
                  <div className="space-y-1">
                    <p className="text-sm"><span className="font-medium">Name:</span> {selectedStudent.first_name} {selectedStudent.last_name}</p>
                    <p className="text-sm"><span className="font-medium">Admission No:</span> {selectedStudent.admission_number}</p>
                    <p className="text-sm"><span className="font-medium">Class:</span> {selectedStudent.class_grade}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Books ({currentBooksCount})</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedBooks.map((book) => (
                      <div key={book.id} className="text-sm">
                        <span className="font-medium">{book.title}</span>
                        <span className="text-gray-500"> × {book.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-sm"><span className="font-medium">Due Date:</span> {format(new Date(formData.due_date), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Separator />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} className="min-w-[100px]">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={!isFormValid}
            className="min-w-[120px] bg-blue-600 hover:bg-blue-700"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Issue {currentBooksCount} Book{currentBooksCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </form>
    </div>
  );
};
