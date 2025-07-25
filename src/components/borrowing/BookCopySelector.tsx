
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Book, Search, Barcode } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BookCopy {
  id: string;
  tracking_code: string;
  status: string;
  condition: string;
  book_id: string;
  books: {
    id: string;
    title: string;
    author: string;
    book_code: string;
  };
}

interface BookCopySelectorProps {
  onSelectBookCopy: (bookCopy: BookCopy) => void;
  selectedBookCopy?: BookCopy | null;
}

export const BookCopySelector = ({ onSelectBookCopy, selectedBookCopy }: BookCopySelectorProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [debouncedTrackingCode, setDebouncedTrackingCode] = useState('');
  const [activeTab, setActiveTab] = useState('browse');

  // Debounce search terms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTrackingCode(trackingCode);
    }, 300);
    return () => clearTimeout(timer);
  }, [trackingCode]);

  // Query for browsing books
  const { data: availableBooks = [], isLoading: isBrowseLoading } = useQuery({
    queryKey: ['available-book-copies-browse', debouncedSearchTerm],
    queryFn: async () => {
      console.log('Searching for books with term:', debouncedSearchTerm);
      
      let query = supabase
        .from('book_copies')
        .select(`
          *,
          books (
            id,
            title,
            author,
            book_code
          )
        `)
        .eq('status', 'available');

      if (debouncedSearchTerm.trim()) {
        query = query.or(`
          books.title.ilike.%${debouncedSearchTerm}%,
          books.author.ilike.%${debouncedSearchTerm}%,
          books.book_code.ilike.%${debouncedSearchTerm}%
        `);
      }

      const { data, error } = await query
        .order('books(title)')
        .limit(50);

      if (error) {
        console.error('Error fetching available books:', error);
        throw error;
      }

      console.log('Found books:', data?.length || 0);
      return data as BookCopy[];
    },
    enabled: activeTab === 'browse',
    staleTime: 10000,
  });

  // Query for tracking code search
  const { data: trackingCodeBooks = [], isLoading: isTrackingLoading } = useQuery({
    queryKey: ['book-copies-tracking', debouncedTrackingCode],
    queryFn: async () => {
      if (!debouncedTrackingCode.trim()) return [];
      
      console.log('Searching by tracking code:', debouncedTrackingCode);
      
      const { data, error } = await supabase
        .from('book_copies')
        .select(`
          *,
          books (
            id,
            title,
            author,
            book_code
          )
        `)
        .eq('status', 'available')
        .ilike('tracking_code', `%${debouncedTrackingCode}%`)
        .order('tracking_code')
        .limit(20);

      if (error) {
        console.error('Error fetching books by tracking code:', error);
        throw error;
      }

      console.log('Found books by tracking code:', data?.length || 0);
      return data as BookCopy[];
    },
    enabled: activeTab === 'tracking' && debouncedTrackingCode.trim().length > 0,
    staleTime: 5000,
  });

  const handleBookSelect = (trackingCode: string) => {
    const books = activeTab === 'browse' ? availableBooks : trackingCodeBooks;
    const selectedBook = books.find(book => book.tracking_code === trackingCode);
    if (selectedBook) {
      onSelectBookCopy(selectedBook);
    }
  };

  const handleTrackingCodeDirectSelect = (code: string) => {
    const book = trackingCodeBooks.find(b => b.tracking_code === code);
    if (book) {
      onSelectBookCopy(book);
      setActiveTab('browse'); // Switch back to browse tab after selection
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="browse" className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Browse Books
          </TabsTrigger>
          <TabsTrigger value="tracking" className="flex items-center gap-2">
            <Barcode className="w-4 h-4" />
            Tracking Code
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="book-search">Search Books</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                id="book-search"
                placeholder="Search by title, author, or book code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select Book Copy</Label>
            <Select 
              value={selectedBookCopy?.tracking_code || ''} 
              onValueChange={handleBookSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a book to issue..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {isBrowseLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading available books...
                  </SelectItem>
                ) : availableBooks.length === 0 ? (
                  <SelectItem value="no-books" disabled>
                    {debouncedSearchTerm ? 'No books found matching your search' : 'No available books'}
                  </SelectItem>
                ) : (
                  availableBooks.map((bookCopy) => (
                    <SelectItem key={bookCopy.id} value={bookCopy.tracking_code}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex flex-col">
                          <span className="font-medium">{bookCopy.books.title}</span>
                          <span className="text-sm text-gray-500">
                            by {bookCopy.books.author} • {bookCopy.tracking_code}
                          </span>
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {bookCopy.condition}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="tracking" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tracking-search">Search by Tracking Code</Label>
            <div className="relative">
              <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                id="tracking-search"
                placeholder="Enter tracking code (e.g., BK001/001/25)..."
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {trackingCodeBooks.length > 0 && (
            <div className="space-y-2">
              <Label>Found Books</Label>
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {trackingCodeBooks.map((bookCopy) => (
                  <Card 
                    key={bookCopy.id} 
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleTrackingCodeDirectSelect(bookCopy.tracking_code)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{bookCopy.books.title}</h4>
                          <p className="text-sm text-gray-600">by {bookCopy.books.author}</p>
                          <p className="text-sm font-mono text-blue-600">{bookCopy.tracking_code}</p>
                        </div>
                        <Badge variant="outline">{bookCopy.condition}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {isTrackingLoading && debouncedTrackingCode && (
            <div className="text-center py-4 text-gray-500">
              Searching for tracking code...
            </div>
          )}

          {!isTrackingLoading && debouncedTrackingCode && trackingCodeBooks.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              No available books found with tracking code "{debouncedTrackingCode}"
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedBookCopy && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Book className="w-5 h-5 text-blue-600 mt-1" />
              <div className="flex-1">
                <h4 className="font-semibold">{selectedBookCopy.books.title}</h4>
                <p className="text-sm text-gray-600">by {selectedBookCopy.books.author}</p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span><strong>Code:</strong> {selectedBookCopy.books.book_code}</span>
                  <span><strong>Tracking:</strong> {selectedBookCopy.tracking_code}</span>
                  <Badge variant="outline">{selectedBookCopy.condition}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
