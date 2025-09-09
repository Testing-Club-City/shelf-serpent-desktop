import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FixedSizeList as List, VariableSizeList } from 'react-window';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, Search, Filter, BarChart3 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from "@/hooks/use-toast";
// Types defined locally for performance component
interface BookWithDetails {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  category_name?: string;
  total_copies: number;
  available_copies: number;
  category_id?: string;
  image_url?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  email?: string;
  phone?: string;
  class_grade?: string;
  class_id?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

interface VirtualScrollListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  searchKeys?: (keyof T)[];
  filterComponent?: React.ReactNode;
  onItemClick?: (item: T, index: number) => void;
  className?: string;
  overscan?: number;
}

function VirtualScrollList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  searchKeys = [],
  filterComponent,
  onItemClick,
  className = "",
  overscan = 5
}: VirtualScrollListProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const listRef = useRef<List>(null);
  
  // Debounced search to improve performance
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
    }, 300); // 300ms debounce
    
    if (searchQuery !== debouncedQuery) {
      setIsSearching(true);
    }
    
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedQuery]);

  // Filtered items with memoization for performance
  const filteredItems = useMemo(() => {
    if (!debouncedQuery.trim()) return items;
    
    const query = debouncedQuery.toLowerCase();
    return items.filter(item => {
      if (searchKeys.length === 0) {
        // If no search keys specified, search all string properties
        return Object.values(item as any).some(value => 
          typeof value === 'string' && value.toLowerCase().includes(query)
        );
      }
      
      // Search only specified keys
      return searchKeys.some(key => {
        const value = item[key];
        return typeof value === 'string' && value.toLowerCase().includes(query);
      });
    });
  }, [items, debouncedQuery, searchKeys]);

  // Memoized row renderer for performance
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = filteredItems[index];
    if (!item) return null;
    
    return (
      <div 
        style={style} 
        onClick={() => onItemClick?.(item, index)}
        className={onItemClick ? 'cursor-pointer' : ''}
      >
        {renderItem(item, index, style)}
      </div>
    );
  }, [filteredItems, renderItem, onItemClick]);

  // Scroll to item programmatically
  const scrollToItem = useCallback((index: number) => {
    listRef.current?.scrollToItem(index, 'start');
  }, []);

  return (
    <div className={`flex flex-col space-y-4 ${className}`}>
      {/* Search Header */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>
        {filterComponent}
        <Badge variant="secondary">
          {filteredItems.length} / {items.length}
        </Badge>
      </div>

      {/* Virtual List */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <List
          ref={listRef}
          height={containerHeight}
          width="100%"
          itemCount={filteredItems.length}
          itemSize={itemHeight}
          overscanCount={overscan}
        >
          {Row}
        </List>
      </div>

      {/* Performance Stats */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 flex items-center space-x-4">
          <span>Rendered: {Math.min(overscan * 2 + Math.ceil(containerHeight / itemHeight), filteredItems.length)} items</span>
          <span>Total: {filteredItems.length} items</span>
          <span>Virtual Height: {filteredItems.length * itemHeight}px</span>
        </div>
      )}
    </div>
  );
}

// High-performance Book List Component
interface PerformanceBookListProps {
  onBookSelect?: (book: BookWithDetails) => void;
  searchQuery?: string;
  categoryFilter?: string;
}

export const PerformanceBookList: React.FC<PerformanceBookListProps> = ({
  onBookSelect,
  searchQuery: externalSearchQuery,
  categoryFilter
}) => {
  const [books, setBooks] = useState<BookWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadTime, setLoadTime] = useState<number>(0);
  const { toast } = useToast();

  const loadBooks = useCallback(async () => {
    const startTime = performance.now();
    setLoading(true);
    
    try {
      const result = await invoke<BookWithDetails[]>('get_books_performance');
      setBooks(result);
      
      const endTime = performance.now();
      setLoadTime(endTime - startTime);
      
      console.log(`📚 Loaded ${result.length} books in ${(endTime - startTime).toFixed(2)}ms`);
    } catch (error) {
      console.error('Failed to load books:', error);
      toast({
        title: "Error",
        description: "Failed to load books. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // Filter books by category if specified
  const filteredBooks = useMemo(() => {
    if (!categoryFilter) return books;
    return books.filter(book => 
      book.category_name?.toLowerCase() === categoryFilter.toLowerCase()
    );
  }, [books, categoryFilter]);

  const renderBookItem = useCallback((book: BookWithDetails, index: number, style: React.CSSProperties) => (
    <div style={style} className="p-2">
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 truncate">{book.title}</h3>
              <p className="text-sm text-gray-600 truncate">by {book.author}</p>
              
              <div className="flex items-center space-x-2 mt-2">
                {book.category_name && (
                  <Badge variant="outline" className="text-xs">
                    {book.category_name}
                  </Badge>
                )}
                <Badge 
                  variant={book.available_copies > 0 ? "default" : "secondary"}
                  className="text-xs"
                >
                  {book.available_copies}/{book.total_copies} available
                </Badge>
              </div>
              
              {book.isbn && (
                <p className="text-xs text-gray-500 mt-1">ISBN: {book.isbn}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  ), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading books with high performance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Performance Metrics */}
      <div className="bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center space-x-6 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <BarChart3 className="w-4 h-4" />
            <span>Load Time: {loadTime.toFixed(2)}ms</span>
          </div>
          <div className="flex items-center space-x-1">
            <BookOpen className="w-4 h-4" />
            <span>{filteredBooks.length} Books</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={loadBooks}
            className="h-7"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Virtual List */}
      <VirtualScrollList
        items={filteredBooks}
        itemHeight={120}
        containerHeight={600}
        renderItem={renderBookItem}
        searchKeys={['title', 'author', 'isbn', 'category_name']}
        onItemClick={onBookSelect}
        overscan={3}
      />
    </div>
  );
};

// High-performance Student List Component
export const PerformanceStudentList: React.FC<{
  onStudentSelect?: (student: Student) => void;
}> = ({ onStudentSelect }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadTime, setLoadTime] = useState<number>(0);
  const { toast } = useToast();

  const loadStudents = useCallback(async () => {
    const startTime = performance.now();
    setLoading(true);
    
    try {
      const result = await invoke<Student[]>('get_students_performance');
      setStudents(result);
      
      const endTime = performance.now();
      setLoadTime(endTime - startTime);
      
      console.log(`👥 Loaded ${result.length} students in ${(endTime - startTime).toFixed(2)}ms`);
    } catch (error) {
      console.error('Failed to load students:', error);
      toast({
        title: "Error",
        description: "Failed to load students. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const renderStudentItem = useCallback((student: Student, index: number, style: React.CSSProperties) => (
    <div style={style} className="p-2">
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900">
                {student.first_name} {student.last_name}
              </h3>
              <p className="text-sm text-gray-600">
                Admission: {student.admission_number}
              </p>
              
              <div className="flex items-center space-x-2 mt-1">
                {student.class_grade && (
                  <Badge variant="outline" className="text-xs">
                    {student.class_grade}
                  </Badge>
                )}
                {student.email && (
                  <span className="text-xs text-gray-500 truncate">
                    {student.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  ), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading students with high performance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Performance Metrics */}
      <div className="bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center space-x-6 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <BarChart3 className="w-4 h-4" />
            <span>Load Time: {loadTime.toFixed(2)}ms</span>
          </div>
          <div className="flex items-center space-x-1">
            <Users className="w-4 h-4" />
            <span>{students.length} Students</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={loadStudents}
            className="h-7"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Virtual List */}
      <VirtualScrollList
        items={students}
        itemHeight={90}
        containerHeight={600}
        renderItem={renderStudentItem}
        searchKeys={['first_name', 'last_name', 'admission_number', 'email']}
        onItemClick={onStudentSelect}
        overscan={5}
      />
    </div>
  );
};

export default VirtualScrollList;
