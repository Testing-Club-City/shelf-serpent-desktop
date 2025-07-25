import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, BookOpen, Users, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useBooks } from '@/hooks/useBooks';
import { useStudents } from '@/hooks/useStudents';
import { useBorrowings } from '@/hooks/useBorrowings';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchResult {
  type: 'book' | 'student' | 'borrowing';
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  icon: React.ReactNode;
  data: any;
}

interface SafeGlobalSearchBarProps {
  value?: string;
  onResultSelect?: (result: SearchResult) => void;
  onSearchTermChange?: (term: string) => void;
  onStudentSelect?: (student: any) => void;
  onBookSelect?: (book: any) => void;
  onBorrowingSelect?: (borrowing: any) => void;
  placeholder?: string;
  className?: string;
}

export const SafeGlobalSearchBar: React.FC<SafeGlobalSearchBarProps> = ({
  value = '',
  onResultSelect,
  onSearchTermChange,
  onStudentSelect,
  onBookSelect,
  onBorrowingSelect,
  placeholder = "Search books, students, or borrowings...",
  className = ""
}) => {
  const [searchTerm, setSearchTerm] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Update internal state when value prop changes
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);
  
  // Debounce search term to avoid too many API calls
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  
  // Fetch data with error boundaries
  const { data: booksData } = useBooks();
  const { data: studentsResponse } = useStudents({
    page: 1,
    pageSize: 50,
    searchTerm: debouncedSearchTerm || ''
  });
  const { data: borrowingsData } = useBorrowings();

  // Safe data extraction with proper type checking
  const books = useMemo(() => {
    try {
      if (Array.isArray(booksData)) return booksData;
      return [];
    } catch (error) {
      console.error('Error processing books data:', error);
      return [];
    }
  }, [booksData]);

  const students = useMemo(() => {
    try {
      // Handle both array and object responses
      if (Array.isArray(studentsResponse)) return studentsResponse;
      if (studentsResponse && Array.isArray(studentsResponse.students)) return studentsResponse.students;
      return [];
    } catch (error) {
      console.error('Error processing students data:', error);
      return [];
    }
  }, [studentsResponse]);

  const borrowings = useMemo(() => {
    try {
      if (Array.isArray(borrowingsData)) return borrowingsData;
      return [];
    } catch (error) {
      console.error('Error processing borrowings data:', error);
      return [];
    }
  }, [borrowingsData]);

  // Perform search with comprehensive error handling
  const performSearch = useCallback((term: string | undefined) => {
    try {
      if (!term || typeof term !== 'string' || !term.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const searchResults: SearchResult[] = [];
      const searchLower = term.toLowerCase();

      // Search books
      if (books.length > 0) {
        try {
          const bookResults = books
            .filter(book => {
              try {
                return book && typeof book === 'object' && (
                  (book.title?.toLowerCase() || '').includes(searchLower) ||
                  (book.author?.toLowerCase() || '').includes(searchLower) ||
                  (book.book_code?.toLowerCase() || '').includes(searchLower) ||
                  (book.isbn?.toLowerCase() || '').includes(searchLower) ||
                  (book.genre?.toLowerCase() || '').includes(searchLower)
                );
              } catch (e) {
                console.error('Error filtering book:', e);
                return false;
              }
            })
            .slice(0, 5)
            .map(book => ({
              type: 'book' as const,
              id: book.id || 'unknown',
              title: book.title || 'Untitled Book',
              subtitle: `by ${book.author || 'Unknown Author'}`,
              description: `${book.available_copies || 0}/${book.total_copies || 0} available • ${book.book_code || 'No Code'}`,
              icon: <BookOpen className="w-4 h-4 text-blue-600" />,
              data: book
            }));
          searchResults.push(...bookResults);
        } catch (error) {
          console.error('Error searching books:', error);
        }
      }

      // Search students
      if (students.length > 0) {
        try {
          const studentResults = students
            .filter(student => {
              try {
                return student && typeof student === 'object' && (
                  (student.admission_number?.toLowerCase() || '').includes(searchLower) ||
                  (student.first_name?.toLowerCase() || '').includes(searchLower) ||
                  (student.last_name?.toLowerCase() || '').includes(searchLower) ||
                  (student.class_grade?.toLowerCase() || '').includes(searchLower) ||
                  `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase().includes(searchLower)
                );
              } catch (e) {
                console.error('Error filtering student:', e);
                return false;
              }
            })
            .sort((a, b) => {
              try {
                const aAdmissionMatch = (a.admission_number?.toLowerCase() || '').startsWith(searchLower);
                const bAdmissionMatch = (b.admission_number?.toLowerCase() || '').startsWith(searchLower);
                if (aAdmissionMatch && !bAdmissionMatch) return -1;
                if (!aAdmissionMatch && bAdmissionMatch) return 1;
                return 0;
              } catch (e) {
                return 0;
              }
            })
            .slice(0, 5)
            .map(student => ({
              type: 'student' as const,
              id: student.id || 'unknown',
              title: `${student.admission_number || 'No ID'} - ${student.first_name || ''} ${student.last_name || ''}`.trim(),
              subtitle: `${student.class_grade || 'No Class'}`,
              description: student.status === 'active' ? 'Active Student' : 'Inactive Student',
              icon: <Users className="w-4 h-4 text-green-600" />,
              data: student
            }));
          searchResults.push(...studentResults);
        } catch (error) {
          console.error('Error searching students:', error);
        }
      }

      // Search borrowings
      if (borrowings.length > 0) {
        try {
          const borrowingResults = borrowings
            .filter(borrowing => {
              try {
                return borrowing && typeof borrowing === 'object' && (
                  (borrowing.tracking_code?.toLowerCase() || '').includes(searchLower) ||
                  (borrowing.books?.title?.toLowerCase() || '').includes(searchLower) ||
                  (borrowing.students?.first_name?.toLowerCase() || '').includes(searchLower) ||
                  (borrowing.students?.last_name?.toLowerCase() || '').includes(searchLower) ||
                  (borrowing.students?.admission_number?.toLowerCase() || '').includes(searchLower)
                );
              } catch (e) {
                console.error('Error filtering borrowing:', e);
                return false;
              }
            })
            .slice(0, 5)
            .map(borrowing => ({
              type: 'borrowing' as const,
              id: borrowing.id || 'unknown',
              title: borrowing.books?.title || 'Unknown Book',
              subtitle: `Borrowed by ${borrowing.students?.first_name || ''} ${borrowing.students?.last_name || ''}`.trim(),
              description: `${borrowing.tracking_code || 'No Code'} • Due: ${borrowing.due_date ? new Date(borrowing.due_date).toLocaleDateString() : 'No Date'}`,
              icon: <FileText className="w-4 h-4 text-orange-600" />,
              data: borrowing
            }));
          searchResults.push(...borrowingResults);
        } catch (error) {
          console.error('Error searching borrowings:', error);
        }
      }

      setResults(searchResults);
      setIsSearching(false);
    } catch (error) {
      console.error('Error in performSearch:', error);
      setResults([]);
      setIsSearching(false);
    }
  }, [books, students, borrowings]);

  // Effect to perform search when debounced term changes
  useEffect(() => {
    performSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, performSearch]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSelectedIndex(-1);
    setIsOpen(value.length > 0);
    
    // Call parent callback
    if (onSearchTermChange) {
      onSearchTermChange(value);
    }
  };

  // Handle result selection
  const handleResultSelect = (result: SearchResult) => {
    setSearchTerm(result.title);
    setIsOpen(false);
    setSelectedIndex(-1);
    
    // Call specific navigation callbacks based on result type
    switch (result.type) {
      case 'student':
        if (onStudentSelect) onStudentSelect(result.data);
        break;
      case 'book':
        if (onBookSelect) onBookSelect(result.data);
        break;
      case 'borrowing':
        if (onBorrowingSelect) onBorrowingSelect(result.data);
        break;
    }
    
    // Call general result select callback
    if (onResultSelect) {
      onResultSelect(result);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleResultSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(searchTerm.length > 0)}
          placeholder={placeholder}
          className="pl-10 pr-4"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-[400px] overflow-y-auto">
          <div className="p-2 space-y-1">
            {results.map((result, index) => (
              <div
                key={`${result.type}-${result.id}`}
                className={`
                  flex items-start gap-3 p-2 rounded-md cursor-pointer
                  ${selectedIndex === index ? 'bg-gray-100' : 'hover:bg-gray-50'}
                `}
                onClick={() => handleResultSelect(result)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {result.icon}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium truncate">{result.title}</p>
                    <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                  </div>
                  <p className="text-sm text-gray-500 truncate">{result.subtitle}</p>
                  {result.description && (
                    <p className="text-xs text-gray-400 truncate">{result.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};