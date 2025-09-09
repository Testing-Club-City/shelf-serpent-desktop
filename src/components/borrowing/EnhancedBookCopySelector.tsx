
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Search, Check, AlertCircle, RotateCcw, Package } from 'lucide-react';
import { 
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useBooks } from '@/hooks/useBooks';
import { useAvailableBookCopies } from '@/hooks/useBookCopies';

interface EnhancedBookCopySelectorProps {
  value: {
    tracking_code: string;
    copy_data?: any;
  };
  onChange: (trackingCode: string, copyData?: any) => void;
  conditionAtIssue: string;
  onConditionChange: (condition: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  disabled?: boolean;
}

export const EnhancedBookCopySelector: React.FC<EnhancedBookCopySelectorProps> = ({
  value,
  onChange,
  conditionAtIssue,
  onConditionChange,
  notes,
  onNotesChange,
  disabled = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [showBookSearch, setShowBookSearch] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Increased to 8 for books
  
  const { data: books, isLoading: booksLoading } = useBooks();
  const { data: availableCopies, isLoading: copiesLoading } = useAvailableBookCopies();

  // Filter books based on search term
  const filteredBooks = books?.filter(book => 
    book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.book_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.genre?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Pagination logic for books
  const totalPages = Math.ceil(filteredBooks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBooks = filteredBooks.slice(startIndex, endIndex);

  // Get available copies for the selected book
  const bookCopies = selectedBook 
    ? availableCopies?.filter(copy => copy.book_id === selectedBook.id) || []
    : [];

  const handleBookSelect = (book: any) => {
    setSelectedBook(book);
    setShowBookSearch(false);
    setCurrentPage(1);
    // Reset copy selection when book changes
    onChange('', null);
  };

  const handleCopySelect = (copy: any) => {
    onChange(copy.tracking_code, copy);
  };

  const resetSelection = () => {
    setSelectedBook(null);
    setSearchTerm('');
    setShowBookSearch(true);
    setCurrentPage(1);
    onChange('', null);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // If we have a selected copy but no selected book, find and set the book
  React.useEffect(() => {
    if (value.copy_data && !selectedBook) {
      const bookForCopy = books?.find(book => book.id === value.copy_data.book_id);
      if (bookForCopy) {
        setSelectedBook(bookForCopy);
        setShowBookSearch(false);
      }
    }
  }, [value.copy_data, selectedBook, books]);

  if (disabled) {
    return (
      <div className="space-y-4 opacity-60">
        <Label className="text-sm font-medium text-gray-700">Book Copy Selection (Disabled)</Label>
        <div className="p-4 text-center text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
          <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>Book selection is disabled</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!selectedBook || showBookSearch ? (
        // Book Search Phase
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700">Search and Select Book</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by title, author, book code, or genre..."
                className="pl-10"
                disabled={booksLoading}
              />
            </div>
          </div>

          {searchTerm && (
            <div className="border rounded-lg bg-white shadow-sm">
              {paginatedBooks.length > 0 ? (
                <>
                  <div className="space-y-1 p-2 max-h-96 overflow-y-auto">
                    {paginatedBooks.map((book) => {
                      const bookAvailableCopies = availableCopies?.filter(copy => copy.book_id === book.id)?.length || 0;
                      return (
                        <div
                          key={book.id}
                          onClick={() => handleBookSelect(book)}
                          className="p-3 border rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                          style={{
                            opacity: bookAvailableCopies > 0 ? 1 : 0.6,
                            cursor: bookAvailableCopies > 0 ? 'pointer' : 'not-allowed'
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">{book.title}</h4>
                                <p className="text-sm text-gray-600">by {book.author}</p>
                                <div className="flex gap-2 mt-1">
                                  {book.book_code && (
                                    <Badge variant="outline" className="text-xs">
                                      {book.book_code}
                                    </Badge>
                                  )}
                                  {book.genre && (
                                    <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700">
                                      {book.genre}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge 
                                variant={bookAvailableCopies > 0 ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {bookAvailableCopies} available
                              </Badge>
                              {book.shelf_location && (
                                <p className="text-xs text-gray-500 mt-1">{book.shelf_location}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Pagination Controls for Books */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-3 border-t bg-gray-50">
                      <div className="text-sm text-gray-600">
                        Showing {startIndex + 1}-{Math.min(endIndex, filteredBooks.length)} of {filteredBooks.length} books
                      </div>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (currentPage > 1) handlePageChange(currentPage - 1);
                              }}
                              className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                            />
                          </PaginationItem>
                          
                          {/* First page */}
                          {currentPage > 2 && (
                            <>
                              <PaginationItem>
                                <PaginationLink 
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handlePageChange(1);
                                  }}
                                >
                                  1
                                </PaginationLink>
                              </PaginationItem>
                              {currentPage > 3 && (
                                <PaginationItem>
                                  <PaginationEllipsis />
                                </PaginationItem>
                              )}
                            </>
                          )}
                          
                          {/* Current page and neighbors */}
                          {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                            const page = Math.max(1, Math.min(totalPages - 2, currentPage - 1)) + i;
                            if (page > totalPages) return null;
                            
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handlePageChange(page);
                                  }}
                                  isActive={currentPage === page}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          })}
                          
                          {/* Last page */}
                          {currentPage < totalPages - 1 && (
                            <>
                              {currentPage < totalPages - 2 && (
                                <PaginationItem>
                                  <PaginationEllipsis />
                                </PaginationItem>
                              )}
                              <PaginationItem>
                                <PaginationLink 
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handlePageChange(totalPages);
                                  }}
                                >
                                  {totalPages}
                                </PaginationLink>
                              </PaginationItem>
                            </>
                          )}
                          
                          <PaginationItem>
                            <PaginationNext 
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (currentPage < totalPages) handlePageChange(currentPage + 1);
                              }}
                              className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No books found matching "{searchTerm}"</p>
                </div>
              )}
            </div>
          )}

          {!searchTerm && (
            <div className="p-4 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>Start typing to search for a book</p>
            </div>
          )}
        </div>
      ) : (
        // Copy Selection Phase
        <div className="space-y-4">
          {/* Selected Book Info */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-900">{selectedBook.title}</h4>
                    <p className="text-sm text-blue-700">by {selectedBook.author}</p>
                    <div className="flex gap-2 mt-1">
                      {selectedBook.book_code && (
                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-300">
                          {selectedBook.book_code}
                        </Badge>
                      )}
                      {selectedBook.shelf_location && (
                        <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                          {selectedBook.shelf_location}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetSelection}
                  className="text-blue-600 border-blue-300 hover:bg-blue-100"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Change Book
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Copy Selection */}
          <div>
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Select Book Copy
            </Label>
            {copiesLoading ? (
              <div className="mt-2 p-4 text-center text-gray-500 border border-gray-200 rounded-lg">
                <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p>Loading available copies...</p>
              </div>
            ) : bookCopies.length > 0 ? (
              <div className="mt-2 grid gap-2 max-h-40 overflow-y-auto">
                {bookCopies.map((copy) => (
                  <Card
                    key={copy.id}
                    onClick={() => handleCopySelect(copy)}
                    className={`cursor-pointer transition-all duration-200 ${
                      value.copy_data?.id === copy.id
                        ? 'bg-green-50 border-green-300 ring-2 ring-green-200 shadow-sm'
                        : 'hover:bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm font-medium">
                            {copy.tracking_code}
                          </p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              Copy #{copy.copy_number}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                copy.condition === 'excellent' ? 'bg-green-100 text-green-700 border-green-300' :
                                copy.condition === 'good' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                                copy.condition === 'fair' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                                'bg-red-100 text-red-700 border-red-300'
                              }`}
                            >
                              {copy.condition || 'Good'}
                            </Badge>
                          </div>
                        </div>
                        {value.copy_data?.id === copy.id && (
                          <div className="flex items-center gap-2">
                            <Check className="w-5 h-5 text-green-600" />
                            <Badge className="bg-green-600 text-white">Selected</Badge>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="mt-2 p-4 text-center text-gray-500 border border-gray-200 rounded-lg">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No available copies for this book</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={resetSelection}
                  className="mt-2"
                >
                  Choose Different Book
                </Button>
              </div>
            )}
          </div>

          {/* Condition and Notes (shown only when copy is selected) */}
          {value.copy_data && (
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <h4 className="font-medium text-gray-900 mb-3">Issue Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Condition at Issue</Label>
                    <Select value={conditionAtIssue} onValueChange={onConditionChange}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Additional Notes</Label>
                    <Input
                      value={notes}
                      onChange={(e) => onNotesChange(e.target.value)}
                      placeholder="Any special notes or remarks..."
                      maxLength={200}
                      className="h-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
