import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, BookOpen, Users, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/useDebounce';
import { invoke } from '@tauri-apps/api/core';

interface SearchResult {
  type: 'book' | 'student' | 'borrowing' | 'book_copy';
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

  // Perform enhanced search using the backend
  const performSearch = useCallback(async (term: string | undefined) => {
    try {
      console.log('🔍 performSearch called with term:', term);
      
      if (!term || typeof term !== 'string' || !term.trim()) {
        console.log('❌ Empty search term, clearing results');
        setResults([]);
        setIsSearching(false);
        return;
      }

      console.log('🚀 Starting search for:', term.trim());
      setIsSearching(true);
      
      // Call the enhanced global search command
      const searchData = await invoke('global_search', {
        query: term.trim(),
        limit: 15
      }) as any;
      
      console.log('✅ Search results received:', searchData);

      const searchResults: SearchResult[] = [];

      // Process students
      if (searchData.students && Array.isArray(searchData.students)) {
        const studentResults = searchData.students.map((student: any) => ({
          type: 'student' as const,
          id: student.id || 'unknown',
          title: `${student.admission_number || 'No ID'} - ${student.first_name || ''} ${student.last_name || ''}`.trim(),
          subtitle: `Class: ${student.class_grade || 'No Class'}`,
          description: `Email: ${student.email || 'No email'} • Phone: ${student.phone_number || 'No phone'}`,
          icon: <Users className="w-4 h-4 text-green-600" />,
          data: student
        }));
        searchResults.push(...studentResults);
      }

      // Process books
      if (searchData.books && Array.isArray(searchData.books)) {
        const bookResults = searchData.books.map((book: any) => ({
          type: 'book' as const,
          id: book.id || 'unknown',
          title: book.title || 'Untitled Book',
          subtitle: `by ${book.author || 'Unknown Author'}`,
          description: `${book.isbn || 'No ISBN'} • Published: ${book.publication_year || 'Unknown'}`,
          icon: <BookOpen className="w-4 h-4 text-blue-600" />,
          data: book
        }));
        searchResults.push(...bookResults);
      }

      // Process book copies (including legacy book IDs)
      if (searchData.book_copies && Array.isArray(searchData.book_copies)) {
        const copyResults = searchData.book_copies.map((copy: any) => ({
          type: 'book_copy' as const,
          id: copy.id || 'unknown',
          title: `${copy.title || 'Unknown Title'} (Copy)`,
          subtitle: `Legacy ID: ${copy.legacy_book_id || 'N/A'} • ${copy.author || 'Unknown Author'}`,
          description: `Status: ${copy.status || 'Unknown'} • Condition: ${copy.condition || 'Unknown'} • Copy ID: ${copy.copy_identifier || 'N/A'}`,
          icon: <BookOpen className="w-4 h-4 text-purple-600" />,
          data: copy
        }));
        searchResults.push(...copyResults);
      }

      // Process active borrowings
      if (searchData.borrowings && Array.isArray(searchData.borrowings)) {
        const borrowingResults = searchData.borrowings.map((borrowing: any) => ({
          type: 'borrowing' as const,
          id: borrowing.id || 'unknown',
          title: `${borrowing.book_title || 'Unknown Book'} (Active Borrowing)`,
          subtitle: `Borrowed by ${borrowing.student_name || 'Unknown Student'} (${borrowing.admission_number || 'No ID'})`,
          description: `Legacy ID: ${borrowing.legacy_book_id || 'N/A'} • Due: ${borrowing.due_date ? new Date(borrowing.due_date).toLocaleDateString() : 'No Date'} • Copy: ${borrowing.copy_identifier || 'N/A'}`,
          icon: <FileText className="w-4 h-4 text-orange-600" />,
          data: borrowing
        }));
        searchResults.push(...borrowingResults);
      }

      console.log('📋 Final search results:', searchResults);
      setResults(searchResults);
      setIsSearching(false);
    } catch (error) {
      console.error('❌ Error in enhanced search:', error);
      setResults([]);
      setIsSearching(false);
    }
  }, []);

  // Effect to perform search when debounced term changes
  useEffect(() => {
    console.log('🔍 Search effect triggered:', { debouncedSearchTerm, searchTerm });
    performSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, performSearch]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log('📝 Input changed:', value);
    setSearchTerm(value);
    setSelectedIndex(-1);
    const shouldOpen = value.length > 0;
    console.log('🔓 Setting isOpen to:', shouldOpen);
    setIsOpen(shouldOpen);
    
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
      case 'book_copy':
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
          onFocus={() => {
            console.log('🎯 Input focused, searchTerm:', searchTerm);
            if (searchTerm.length > 0) {
              console.log('🔓 Opening dropdown on focus');
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className="pl-10 pr-4"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>

      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-full left-0 text-xs text-gray-400 bg-yellow-50 p-1 rounded mt-1 z-40">
          isOpen: {isOpen.toString()}, results: {results.length}, searching: {isSearching.toString()}
        </div>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-[400px] overflow-y-auto">
          <div className="p-2 space-y-1">
            <div className="text-xs text-gray-500 px-2 py-1">
              Found {results.length} results for "{searchTerm}"
            </div>
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