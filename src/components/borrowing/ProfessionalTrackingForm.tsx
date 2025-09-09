import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Check, 
  ChevronsUpDown, 
  User, 
  BookOpen, 
  Calendar, 
  AlertTriangle,
  Search,
  CheckCircle,
  X,
  Hash,
  Users,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBooks } from '@/hooks/useBooks';
import { useStudents } from '@/hooks/useStudents';
import { useBookCopies } from '@/hooks/useBookCopies';
import { useClasses } from '@/hooks/useClasses';
import { useBorrowingsArray } from '@/hooks/useBorrowings';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { format, addDays } from 'date-fns';
import { BookCopyInfo } from '@/components/ui/book-copy-info';
import { toast } from '@/components/ui/use-toast';

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
  categories?: {
    id: string;
    name: string;
  };
}

interface BookCopy {
  id: string;
  book_id: string;
  book_code: string;
  condition: string;
  status: string;
  copy_number: number;
  tracking_code?: string;
  created_at?: string;
  updated_at?: string;
}

interface Class {
  id: string;
  class_name: string;
  max_books_allowed?: number;
  form_level?: number;
}

interface ProfessionalTrackingFormProps {
  onSubmit: (data: any[]) => void;
  onCancel: () => void;
}

export const ProfessionalTrackingForm = ({ onSubmit, onCancel }: ProfessionalTrackingFormProps) => {
  const { data: books = [] } = useBooks();
  const { data: studentsResponse } = useStudents();
  const { data: bookCopiesData } = useBookCopies();
  const bookCopies = bookCopiesData?.data || [];
  
  // Extract students array safely
  const students = Array.isArray(studentsResponse?.students) ? studentsResponse.students : [];
  const { data: classes = [] } = useClasses();
  const { data: borrowings = [] } = useBorrowingsArray();
  const { data: systemSettings } = useSystemSettings();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedBooks, setSelectedBooks] = useState<(Book & { selectedCopy?: BookCopy })[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [bookSearchTerm, setBookSearchTerm] = useState('');
  const [openStudentPopover, setOpenStudentPopover] = useState(false);
  const [openBookPopover, setOpenBookPopover] = useState(false);
  const [showInactiveWarning, setShowInactiveWarning] = useState(false);
  const [studentPage, setStudentPage] = useState(1);
  const [bookPage, setBookPage] = useState(1);
  const [openBookCodePopovers, setOpenBookCodePopovers] = useState<{[bookId: string]: boolean}>({});
  const [bookCodeSearchTerms, setBookCodeSearchTerms] = useState<{[bookId: string]: string}>({});
  const [bookCodeYearFilters, setBookCodeYearFilters] = useState<{[bookId: string]: string}>({});
  const [bookCodeConditionFilters, setBookCodeConditionFilters] = useState<{[bookId: string]: string}>({});
  const [bookCodePages, setBookCodePages] = useState<{[bookId: string]: number}>({});
  const itemsPerPage = 20;
  const selectedBooksPerPage = 3;
  const bookCodeItemsPerPage = 8;
  
  const [formData, setFormData] = useState({
    due_date: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
    notes: '',
    condition_at_issue: 'good'
  });

  // Reset pagination when search terms change
  useEffect(() => {
    setStudentPage(1);
  }, [studentSearchTerm]);

  useEffect(() => {
    setBookPage(1);
  }, [bookSearchTerm]);

  // Get student's class info and borrowing limits
  const studentClass = selectedStudent?.class_id 
    ? classes.find(cls => cls.id === selectedStudent.class_id)
    : null;
  
  // Get form level from class name or form_level field
  const getFormLevel = () => {
    console.log("Getting form level for:", selectedStudent);
    console.log("Student class:", studentClass);
    
    // Helper function to extract form level from a string
    const extractFormLevel = (str: string | undefined | null) => {
      if (!str) return null;
      
      // Try various patterns:
      // 1. "Form X" or "form X" where X is a number
      const formPattern = /form\s*(\d+)/i;
      // 2. "FX" or "fX" where X is a number
      const shortFormPattern = /f(\d+)/i;
      // 3. Just a number at the beginning
      const numberPattern = /^(\d+)/;
      
      let match = str.match(formPattern);
      if (match && match[1]) {
        return parseInt(match[1]);
      }
      
      match = str.match(shortFormPattern);
      if (match && match[1]) {
        return parseInt(match[1]);
      }
      
      match = str.match(numberPattern);
      if (match && match[1]) {
        return parseInt(match[1]);
      }
      
      return null;
    };
    
    if (!studentClass) {
      // If no class is found, try to get form level from class_grade field
      if (selectedStudent?.class_grade) {
        console.log("Trying to extract form level from class_grade:", selectedStudent.class_grade);
        const formLevel = extractFormLevel(selectedStudent.class_grade);
        if (formLevel) {
          console.log("Extracted form level from class_grade:", formLevel);
          return formLevel;
        }
      }
      console.log("No form level found from class_grade");
      return null;
    }
    
    // Try to get form level from form_level field first
    if (studentClass.form_level) {
      console.log("Found form_level in student class:", studentClass.form_level);
      return studentClass.form_level;
    }
    
    // Otherwise, try to extract from class name
    console.log("Trying to extract form level from class_name:", studentClass.class_name);
    const formLevelFromClassName = extractFormLevel(studentClass.class_name);
    if (formLevelFromClassName) {
      console.log("Extracted form level from class_name:", formLevelFromClassName);
      return formLevelFromClassName;
    }
    
    // If still not found, try class_grade field as a fallback
    if (selectedStudent?.class_grade) {
      console.log("Trying to extract form level from class_grade as fallback:", selectedStudent.class_grade);
      const formLevel = extractFormLevel(selectedStudent.class_grade);
      if (formLevel) {
        console.log("Extracted form level from class_grade fallback:", formLevel);
        return formLevel;
      }
    }
    
    console.log("No form level found");
    return null;
  };
  
  // Get max books allowed based on form level from system settings
  const getMaxBooksAllowed = () => {
    const formLevel = getFormLevel();
    console.log('=== DEBUG: Getting max books allowed ===');
    console.log('Form level:', formLevel);
    console.log('System settings available:', !!systemSettings);
    console.log('System settings count:', systemSettings?.length);
    
    if (!formLevel) {
      console.log('No form level found, returning default 3');
      return 3;
    }
    
    if (!systemSettings) {
      console.log('No system settings found, returning default 3');
      return 3;
    }
    
    // Find max_books_per_class setting (not max_books_per_student)
    const maxBooksSettingObj = systemSettings.find(s => s.setting_key === 'max_books_per_class');
    console.log('Max books setting object:', maxBooksSettingObj);
    
    if (!maxBooksSettingObj) {
      console.log('No max_books_per_class setting found, returning default 3');
      return 3;
    }
    
    if (!maxBooksSettingObj.setting_value) {
      console.log('Max books setting has no value, returning default 3');
      return 3;
    }
    
    try {
      // Parse the setting value
      const parsedValue = typeof maxBooksSettingObj.setting_value === 'string'
        ? JSON.parse(maxBooksSettingObj.setting_value)
        : maxBooksSettingObj.setting_value;
      
      console.log('Parsed settings value:', parsedValue);
      
      // Get limit based on form level using the correct key format
      const formKey = `Form ${formLevel}`;  // e.g., "Form 1", "Form 2", etc.
      console.log('Looking for form key:', formKey);
      console.log('Available keys in settings:', Object.keys(parsedValue));
      
      const result = parsedValue[formKey] || 3;
      console.log('Final result for form level', formLevel, ':', result);
      return result;
    } catch (error) {
      console.error('Error parsing max books setting:', error);
      return 3; // Return default 3 instead of 0
    }
  };
  
  const maxBooksAllowed = getMaxBooksAllowed();
  
  // Get active borrowings for the selected student
  const studentActiveBorrowings = selectedStudent
    ? (borrowings || []).filter(b => b.student_id === selectedStudent.id && b.status === 'active')
    : [];
  
  const currentlyBorrowed = studentActiveBorrowings.length;
  const remainingAllowedBooks = Math.max(0, maxBooksAllowed - currentlyBorrowed);
  const currentBooksCount = selectedBooks.length; // One copy per book rule
  
  // Check if student has reached their borrowing limit
  const hasReachedLimit = remainingAllowedBooks <= 0;
  const willExceedLimit = currentBooksCount >= remainingAllowedBooks;

  // Filter available books (only show books with available copies)
  const availableBooks = books.filter(book => book.available_copies > 0);

  // Filter students and books based on search
  const filteredStudents = students.filter(student => {
    if (!studentSearchTerm) return true;
    const searchLower = studentSearchTerm.toLowerCase();
    return (
      student.first_name.toLowerCase().includes(searchLower) ||
      student.last_name.toLowerCase().includes(searchLower) ||
      student.admission_number.toLowerCase().includes(searchLower)
    );
  });

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

  // Check if all selected books have copies assigned
  const allBooksHaveCopies = selectedBooks.every(book => book.selectedCopy);
  const isFormValid = selectedStudent && selectedBooks.length > 0 && allBooksHaveCopies && formData.due_date;

  useEffect(() => {
    setShowInactiveWarning(selectedStudent?.status === 'inactive');
  }, [selectedStudent]);

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setOpenStudentPopover(false);
    setStudentSearchTerm('');
  };

  const handleBookSelect = (book: Book) => {
    // ONE COPY PER BOOK RULE: Check if book is already selected
    const isAlreadySelected = selectedBooks.find(b => b.id === book.id);
    if (isAlreadySelected) {
      return; // Don't allow multiple copies of same book
    }

    // Check borrowing limit
    if (currentBooksCount >= remainingAllowedBooks) {
      return;
    }

    // Check if there are available copies for this book
    const availableCopies = bookCopies.filter(copy => 
      copy.book_id === book.id && copy.status === 'available'
    );
    
    if (availableCopies.length === 0) {
      return; // No available copies
    }

    // Add book without auto-selecting a copy - user will choose manually
    setSelectedBooks(books => [...books, { ...book, selectedCopy: undefined }]);
    setOpenBookPopover(false);
    setBookSearchTerm('');

    // Reset pagination, search and filters for this book's codes
    setBookCodePages(prev => ({ ...prev, [book.id]: 1 }));
    setBookCodeSearchTerms(prev => ({ ...prev, [book.id]: '' }));
    setBookCodeYearFilters(prev => ({ ...prev, [book.id]: 'all' }));
    setBookCodeConditionFilters(prev => ({ ...prev, [book.id]: 'all' }));
  };

  const handleRemoveBook = (bookId: string) => {
    setSelectedBooks(books => books.filter(b => b.id !== bookId));
  };

  // Handle book code selection
  const handleBookCodeSelect = (bookId: string, copyId: string) => {
    // Ensure we have the correct book copy regardless of which page it's on
    const bookCopy = bookCopies.find(copy => copy.id === copyId);
    
    if (bookCopy) {
      setSelectedBooks(books => 
        books.map(book => 
          book.id === bookId 
            ? { ...book, selectedCopy: bookCopy }
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

  // Filter book codes based on search term, year, and condition
  const getFilteredBookCodes = (bookId: string, availableCopies: BookCopy[]) => {
    const searchTerm = bookCodeSearchTerms[bookId]?.toLowerCase() || '';
    const yearFilter = bookCodeYearFilters[bookId] || 'all';
    const conditionFilter = bookCodeConditionFilters[bookId] || 'all';

    // If no filters are applied, return all available copies
    if (!searchTerm && yearFilter === 'all' && conditionFilter === 'all') {
      return availableCopies;
    }

    return availableCopies.filter(copy => {
      const codeText = (copy.tracking_code || `${copy.book_code}/${copy.copy_number}`).toLowerCase();
      const copyYear = copy.created_at ? new Date(copy.created_at).getFullYear().toString() : '';
      
      const matchesSearch = !searchTerm || 
        codeText.includes(searchTerm) ||
        copy.copy_number.toString().includes(searchTerm);
      
      const matchesYear = yearFilter === 'all' || copyYear === yearFilter;
      const matchesCondition = conditionFilter === 'all' || copy.condition === conditionFilter;
      
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
    
    // Validation checks
    if (!selectedStudent) {
      toast({
        title: "No Student Selected",
        description: "Please select a student before proceeding.",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedBooks.length === 0) {
      toast({
        title: "No Books Selected",
        description: "Please select at least one book before proceeding.",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.due_date) {
      toast({
        title: "Missing Due Date",
        description: "Please select a due date for the borrowing.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if all selected books have copies assigned
    const unassignedBooks = selectedBooks.filter(book => !book.selectedCopy);
    if (unassignedBooks.length > 0) {
      toast({
        title: "Missing Book Copies",
        description: `Please select specific copies for all books (${unassignedBooks.length} missing).`,
        variant: "destructive",
      });
      return;
    }
    
    // Check if borrowing limit will be exceeded
    if (selectedBooks.length > remainingAllowedBooks) {
      toast({
        title: "Borrowing Limit Exceeded",
        description: `This student can only borrow ${remainingAllowedBooks} more book(s) based on their form level.`,
        variant: "destructive",
      });
      return;
    }

    if (showInactiveWarning && !confirm('This student is inactive. Do you want to proceed with the borrowing?')) {
      return;
    }

    if (!isFormValid) return;

    // Create borrowing records for each selected book
    const borrowingRecords = selectedBooks.map(book => ({
      student_id: selectedStudent!.id,
      book_id: book.id,
      book_copy_id: book.selectedCopy!.id,
      tracking_code: book.selectedCopy!.tracking_code || `${book.book_code}/${book.selectedCopy!.copy_number}`,
      due_date: formData.due_date,
      notes: formData.notes,
      condition_at_issue: formData.condition_at_issue,
      copy_condition: book.selectedCopy!.condition
    }));

    onSubmit(borrowingRecords);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <BookCopyInfo variant="full" />
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Student Selection Card */}
        <Card className="border-2 hover:border-blue-200 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-blue-600" />
              Student Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student">Select Student</Label>
              <Popover open={openStudentPopover} onOpenChange={setOpenStudentPopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openStudentPopover}
                    className="w-full justify-between h-auto min-h-[60px] p-4"
                  >
                    {selectedStudent ? (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex flex-col">
                          <div className="font-medium">
                            {selectedStudent.first_name} {selectedStudent.last_name}
                        </div>
                          <div className="text-sm text-gray-500 flex items-center flex-wrap gap-1">
                            <span>{selectedStudent.admission_number}</span>
                            <span>•</span>
                            <Badge variant="outline" className="bg-gray-50 text-gray-700 text-xs">
                              {selectedStudent.class_grade}
                            </Badge>
                            {getFormLevel() && (
                              <Badge variant="outline" className="bg-purple-100 text-purple-800 text-xs">
                                Form {getFormLevel()}
                              </Badge>
                            )}
                            <div className="flex items-center ml-1">
                              <Badge variant="outline" className="bg-blue-50 text-xs">
                                <BookOpen className="w-3 h-3 mr-1" />
                                {currentlyBorrowed}/{maxBooksAllowed} books
                              </Badge>
                              {currentlyBorrowed > 0 && (
                                <span className="ml-2 text-xs text-blue-600">
                                  ({remainingAllowedBooks} remaining)
                              </span>
                            )}
                            </div>
                          </div>
                        </div>
                        {selectedStudent.status === 'inactive' && (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Search className="w-4 h-4" />
                        <span>Search and select a student...</span>
                      </div>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0">
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
                        {paginatedStudents.map((student) => {
                          const studentClassInfo = student.class_id 
                            ? classes.find(cls => cls.id === student.class_id)
                            : null;
                          
                          // Get student's form level
                          const getStudentFormLevel = () => {
                            // Helper function to extract form level from a string
                            const extractFormLevel = (str: string | undefined | null) => {
                              if (!str) return null;
                              
                              // Try various patterns:
                              // 1. "Form X" or "form X" where X is a number
                              const formPattern = /form\s*(\d+)/i;
                              // 2. "FX" or "fX" where X is a number
                              const shortFormPattern = /f(\d+)/i;
                              // 3. Just a number at the beginning
                              const numberPattern = /^(\d+)/;
                              
                              let match = str.match(formPattern);
                              if (match && match[1]) {
                                return parseInt(match[1]);
                              }
                              
                              match = str.match(shortFormPattern);
                              if (match && match[1]) {
                                return parseInt(match[1]);
                              }
                              
                              match = str.match(numberPattern);
                              if (match && match[1]) {
                                return parseInt(match[1]);
                              }
                              
                              return null;
                            };
                            
                            if (!studentClassInfo) {
                              // If no class is found, try to get form level from class_grade field
                              if (student.class_grade) {
                                return extractFormLevel(student.class_grade);
                              }
                              return null;
                            }
                            
                            if (studentClassInfo.form_level) {
                              return studentClassInfo.form_level;
                            }
                            
                            const formLevelFromClassName = extractFormLevel(studentClassInfo.class_name);
                            if (formLevelFromClassName) {
                              return formLevelFromClassName;
                            }
                            
                            // If still not found, try class_grade field as a fallback
                            if (student.class_grade) {
                              return extractFormLevel(student.class_grade);
                            }
                            
                            return null;
                          };
                          
                          // Get max books allowed based on form level
                          const getStudentMaxBooks = () => {
                            const formLevel = getStudentFormLevel();
                            if (!formLevel || !systemSettings) return 3;
                            
                            const maxBooksSettingObj = systemSettings.find(s => s.setting_key === 'max_books_per_student');
                            if (!maxBooksSettingObj || !maxBooksSettingObj.setting_value) return 3;
                            
                            try {
                              const parsedValue = typeof maxBooksSettingObj.setting_value === 'string'
                                ? JSON.parse(maxBooksSettingObj.setting_value)
                                : maxBooksSettingObj.setting_value;
                              
                              const formKey = `form${formLevel}`;
                              return parsedValue[formKey] || 3;
                            } catch (error) {
                              return 3;
                            }
                          };
                          
                          const studentFormLevel = getStudentFormLevel();
                          const studentMaxBooks = getStudentMaxBooks();
                          const studentActiveBorrowings = borrowings.filter(
                            b => b.student_id === student.id && b.status === 'active'
                          );
                          const studentBorrowedCount = studentActiveBorrowings.length;
                          const studentRemainingBooks = Math.max(0, studentMaxBooks - studentBorrowedCount);
                          
                          return (
                            <CommandItem
                              key={student.id}
                              onSelect={() => handleStudentSelect(student)}
                              className="flex items-center justify-between p-3 cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                <Check
                                  className={cn(
                                    "h-4 w-4",
                                    selectedStudent?.id === student.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div>
                                  <div className="font-medium">{student.first_name} {student.last_name}</div>
                                  <div className="text-sm text-gray-500">
                                    {student.admission_number} • {student.class_grade}
                                      <span className="ml-2 text-blue-600">
                                      <Badge variant="outline" className="bg-blue-50 text-xs ml-1">
                                        <BookOpen className="w-3 h-3 mr-1" />
                                        {studentBorrowedCount}/{studentMaxBooks}
                                      </Badge>
                                      </span>
                                    {studentFormLevel && (
                                      <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs ml-1">
                                        Form {studentFormLevel}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {studentBorrowedCount >= studentMaxBooks ? (
                                  <Badge variant="destructive" className="text-xs">At Limit</Badge>
                                ) : studentRemainingBooks <= 1 ? (
                                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                                    {studentRemainingBooks} left
                                  </Badge>
                                ) : null}
                                
                              {student.status === 'inactive' && (
                                <Badge variant="destructive">Inactive</Badge>
                              )}
                              </div>
                            </CommandItem>
                          );
                        })}
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

            {/* Inactive Warning */}
            {showInactiveWarning && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Warning:</strong> This student is currently inactive. Please verify before proceeding.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Books Selection Card */}
        <Card className="border-2 hover:border-green-200 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-green-600" />
                Professional Book Selection
              </div>
              <Badge variant="outline" className="font-medium">
                {currentBooksCount} / {remainingAllowedBooks} allowed
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Book Borrowing Limit Info */}
            <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Borrowing Limit Information</span>
                </div>
              </div>
              <div className="mt-2 space-y-1 pl-6">
                <div className="flex items-center justify-between">
                  <span className="text-blue-700">Student Form Level:</span>
                  <span className="font-medium">
                    {getFormLevel() 
                      ? <Badge className="bg-purple-100 text-purple-800">Form {getFormLevel()}</Badge> 
                      : <Badge variant="outline" className="text-gray-500">Unknown</Badge>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-700">Max books allowed:</span>
                  <span className="font-medium">{maxBooksAllowed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-700">Currently borrowed:</span>
                  <span className="font-medium">{currentlyBorrowed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-700">Remaining allowed:</span>
                  <span className="font-medium">{remainingAllowedBooks}</span>
                </div>
              </div>
            </div>
            
            {/* Book Search */}
            <div className="space-y-2">
              <Label htmlFor="book">Select Books (One Copy Per Book)</Label>
              <Popover open={openBookPopover} onOpenChange={setOpenBookPopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openBookPopover}
                    className="w-full justify-between h-auto min-h-[50px] p-3"
                    disabled={hasReachedLimit}
                  >
                    {hasReachedLimit ? (
                      <span className="text-red-600">Borrowing limit reached</span>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Search className="w-4 h-4" />
                        <span>Search and select books with tracking codes...</span>
                      </div>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[700px] p-0">
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
                    <CommandList className="max-h-96">
                      <CommandEmpty>No available books found.</CommandEmpty>
                      <CommandGroup>
                        {paginatedBooks.map((book) => {
                          const isSelected = selectedBooks.find(b => b.id === book.id);
                          const canSelect = !isSelected && currentBooksCount < remainingAllowedBooks;
                          const availableCopies = bookCopies.filter(copy => 
                            copy.book_id === book.id && copy.status === 'available'
                          );
                          const nextCopy = availableCopies[0];
                          
                          return (
                            <CommandItem
                              key={book.id}
                              onSelect={() => canSelect && handleBookSelect(book)}
                              className={cn(
                                "flex items-center justify-between p-4 cursor-pointer border-b border-gray-100 last:border-b-0 min-h-[120px]",
                                isSelected && "bg-blue-50 border-blue-200",
                                !canSelect && "opacity-50 cursor-not-allowed"
                              )}
                              disabled={!canSelect}
                            >
                              <div className="flex items-start gap-4 flex-1 min-w-0">
                                <div className="flex-shrink-0 mt-1">
                                  {isSelected ? (
                                    <CheckCircle className="h-6 w-6 text-blue-600" />
                                  ) : (
                                    <div className="h-6 w-6 border-2 border-gray-300 rounded-full" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-gray-900 text-base mb-1">{book.title}</div>
                                  <div className="text-sm text-gray-600 mb-3">
                                    by {book.author} {book.isbn && `• ISBN: ${book.isbn}`}
                                  </div>
                                  
                                  {/* Book Information */}
                                  <div className="flex items-center gap-2 mb-3 flex-wrap">
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
                                  
                                  {/* Next Available Copy */}
                                  {nextCopy && !isSelected && (
                                    <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                                      <div className="text-xs text-yellow-800 font-medium mb-2">📋 Copy to be issued:</div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Badge className="bg-blue-100 text-blue-800 font-bold">
                                          Copy #{nextCopy.copy_number}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs">
                                          Condition: {nextCopy.condition || 'Good'}
                                        </Badge>
                                        <div className="w-full mt-1">
                                          <span className="text-xs text-muted-foreground font-mono">System ID: {nextCopy.tracking_code || `${book.book_code}/${nextCopy.copy_number}`}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {isSelected && (
                                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                      <div className="text-xs text-blue-800 font-medium">✅ Selected for issuing</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex-shrink-0 ml-4">
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

            {/* Selected Books Display */}
            {selectedBooks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">📚 Selected Books (One Copy Per Book)</Label>
                  <Badge variant="outline" className="bg-blue-50">
                    {selectedBooks.length} book{selectedBooks.length !== 1 ? 's' : ''} selected
                  </Badge>
                </div>
                <div className="border rounded-lg bg-gray-50">
                  <ScrollArea className="h-[400px]" type="always">
                    <div className="p-4 space-y-4">
                    {selectedBooks.map((book) => (
                      <div key={book.id} className="bg-white rounded-lg p-4 border shadow-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-base mb-1">{book.title}</div>
                            <div className="text-sm text-gray-600 mb-3">by {book.author}</div>
                            
                            {/* Book Information */}
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              {book.book_code && (
                                <Badge variant="outline" className="text-xs font-mono bg-blue-50 text-blue-700">
                                  📖 Book: {book.book_code}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">
                                {book.available_copies} available
                              </Badge>
                            </div>
                            
                            {/* Book Code Selection */}
                            <div className="mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-sm font-medium text-gray-700">Select Book Code *</Label>
                                {!book.selectedCopy && (
                                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">
                                    No copy selected
                                  </Badge>
                                )}
                              </div>
                              
                              {book.selectedCopy ? (
                                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-3 border-l-4 border-yellow-500">
                                  <div className="text-xs text-gray-700 font-medium mb-2">🏷️ Selected copy:</div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className="bg-blue-100 text-blue-800 font-bold">
                                      Copy #{book.selectedCopy.copy_number}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                                      Condition: {book.selectedCopy.condition || 'Good'}
                                    </Badge>
                                    {book.selectedCopy.created_at && (
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                        Added: {new Date(book.selectedCopy.created_at).getFullYear()}
                                      </Badge>
                                    )}
                                    <div className="w-full mt-1">
                                      <span className="text-xs text-muted-foreground font-mono">
                                        System ID: {book.selectedCopy.tracking_code || `${book.book_code}/${book.selectedCopy.copy_number}`}
                                      </span>
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="mt-2 h-6 text-xs text-blue-600 hover:text-blue-700"
                                    onClick={() => setOpenBookCodePopovers(prev => ({ ...prev, [book.id]: true }))}
                                  >
                                    Change Copy
                                  </Button>
                                </div>
                              ) : (
                                <Popover 
                                  open={openBookCodePopovers[book.id] || false} 
                                  onOpenChange={(open) => setOpenBookCodePopovers(prev => ({ ...prev, [book.id]: open }))}
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className="w-full justify-between h-10 text-sm border-2 border-dashed border-orange-300 hover:border-orange-400"
                                    >
                                        <div className="flex items-center gap-2">
                                      <span className="text-gray-600">Click to select book code...</span>
                                          {(() => {
                                            const availableCopies = bookCopies.filter(copy => 
                                              copy.book_id === book.id && copy.status === 'available'
                                            );
                                            if (availableCopies.length > 0) {
                                              return (
                                                <Badge className="bg-green-100 text-green-800">
                                                  {availableCopies.length} {availableCopies.length === 1 ? 'copy' : 'copies'} available
                                                </Badge>
                                              );
                                            }
                                            return null;
                                          })()}
                                        </div>
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                                                {(() => {
                                                  const availableCopies = bookCopies.filter(copy => 
                                                    copy.book_id === book.id && copy.status === 'available'
                                                  );
                                                  return getAvailableYears(availableCopies).map(year => (
                                                    <SelectItem key={year} value={year}>{year}</SelectItem>
                                                  ));
                                                })()}
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
                                                {(() => {
                                                  const availableCopies = bookCopies.filter(copy => 
                                                    copy.book_id === book.id && copy.status === 'available'
                                                  );
                                                  return getAvailableConditions(availableCopies).map(condition => (
                                                    <SelectItem key={condition} value={condition}>
                                                      {condition.charAt(0).toUpperCase() + condition.slice(1)}
                                                    </SelectItem>
                                                  ));
                                                })()}
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
                                            }}
                                          >
                                            Clear Filters
                                          </Button>
                                        )}
                                      </div>
                                      
                                      <CommandList className="max-h-64">
                                        <CommandEmpty>
                                          <div className="text-center py-4">
                                            <div className="text-xs text-gray-500">No book codes found</div>
                                            <div className="text-xs text-gray-400 mt-1">Try adjusting your filters</div>
                                          </div>
                                        </CommandEmpty>
                                        <ScrollArea className="max-h-60">
                                          <CommandGroup>
                                            {(() => {
                                              const availableCopies = bookCopies.filter(copy => 
                                                copy.book_id === book.id && copy.status === 'available'
                                              );
                                              const filteredCopies = getFilteredBookCodes(book.id, availableCopies);
                                              
                                              console.log(`Book "${book.title}" - Available copies:`, availableCopies.length, 'Filtered:', filteredCopies.length);
                                              
                                                // Show ALL available copies without pagination for better visibility
                                                if (filteredCopies.length === 0) {
                                                  return (
                                                    <div className="text-center py-4">
                                                      <div className="text-xs text-gray-500">No matching copies found</div>
                                                      <div className="text-xs text-gray-400 mt-1">Try adjusting your filters</div>
                                                    </div>
                                                  );
                                                }

                                              return filteredCopies.map((copy) => (
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
                                                  className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50"
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <Check
                                                      className={cn(
                                                        "h-3 w-3",
                                                        book.selectedCopy?.id === copy.id ? "opacity-100" : "opacity-0"
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
                                                        {copy.tracking_code || `${copy.book_code}/${copy.copy_number}`}
                                                      </div>
                                                      {copy.created_at && (
                                                        <div className="text-xs text-gray-500">
                                                          Added: {new Date(copy.created_at).getFullYear()}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                </CommandItem>
                                              ));
                                            })()}
                                          </CommandGroup>
                                        </ScrollArea>
                                          
                                          {/* Add a summary of available copies */}
                                          <div className="p-2 border-t bg-gray-50 text-xs text-gray-600">
                                            {(() => {
                                              const availableCopies = bookCopies.filter(copy => 
                                                copy.book_id === book.id && copy.status === 'available'
                                              );
                                              const filteredCopies = getFilteredBookCodes(book.id, availableCopies);
                                              return `Showing ${filteredCopies.length} of ${availableCopies.length} available copies`;
                                            })()}
                                          </div>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 ml-4">
                            <div className="text-center">
                              <div className="text-xs text-gray-500 mb-1">Quantity</div>
                              <Badge className="bg-blue-100 text-blue-800 font-bold text-lg px-3 py-1">1</Badge>
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
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                </div>
              </div>
            )}

            {/* Borrowing Limit Warning */}
            {hasReachedLimit && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <strong>Borrowing limit reached!</strong> This student has already borrowed {currentlyBorrowed} books, 
                  which is the maximum allowed for Form {getFormLevel()} students ({maxBooksAllowed} books).
                </AlertDescription>
              </Alert>
            )}

            {!hasReachedLimit && willExceedLimit && currentBooksCount > 0 && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <strong>Approaching limit!</strong> Form {getFormLevel()} students can borrow up to {maxBooksAllowed} books. 
                  You can only select {remainingAllowedBooks} more book(s) for this student.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Borrowing Details Card */}
        <Card className="border-2 hover:border-purple-200 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
              Borrowing Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition">Condition at Issue</Label>
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
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about this borrowing..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary Card */}
        {selectedStudent && selectedBooks.length > 0 && (
          <Card className="border-2 border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-green-800">
                <CheckCircle className="w-5 h-5" />
                Issue Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Student Details</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Name:</span> {selectedStudent.first_name} {selectedStudent.last_name}</p>
                    <p><span className="font-medium">Admission No:</span> {selectedStudent.admission_number}</p>
                    <p><span className="font-medium">Class:</span> {selectedStudent.class_grade}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Books & Tracking Codes ({currentBooksCount})</h4>
                  <div className="space-y-2">
                    {selectedBooks.map((book) => (
                      <div key={book.id} className="text-sm">
                        <div className="font-medium">{book.title}</div>
                        <div className="text-xs text-gray-600 flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {book.selectedCopy 
                            ? (book.selectedCopy.tracking_code || `${book.book_code}/${book.selectedCopy.copy_number}`)
                            : <span className="text-orange-600 font-medium">⚠️ No copy selected</span>
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 text-sm">
                    <p><span className="font-medium">Due Date:</span> {format(new Date(formData.due_date), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-6">
          <Button type="button" variant="outline" onClick={onCancel} className="min-w-[100px]">
            Cancel
          </Button>
          <Button 
            type="submit" 
            className="min-w-[150px] bg-green-600 hover:bg-green-700"
            disabled={!isFormValid}
            title={
              !selectedStudent ? 'Please select a student' :
              selectedBooks.length === 0 ? 'Please select at least one book' :
              !allBooksHaveCopies ? 'Please select book codes for all books' :
              !formData.due_date ? 'Please set a due date' :
              'Ready to issue books'
            }
          >
            📚 Issue {currentBooksCount} Book{currentBooksCount !== 1 ? 's' : ''}
            {!allBooksHaveCopies && selectedBooks.length > 0 && (
              <span className="ml-2 text-xs">({selectedBooks.filter(b => !b.selectedCopy).length} missing codes)</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
