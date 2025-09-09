import React, { useState } from 'react';
import { useAvailableBookCopies } from '@/hooks/useBookCopies';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { fixMissingBookCopies } from '@/utils/fixMissingBookCopies';
import { useToast } from '@/hooks/use-toast';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface AvailableCopiesCardProps {
  bookId?: string;
  bookTitle?: string;
  onCopySelect?: (copy: any) => void;
  selectedCopyId?: string;
  onIssueBook?: (copy: any) => void;
}

const ITEMS_PER_PAGE = 10;

const AvailableCopiesCard: React.FC<AvailableCopiesCardProps> = ({ 
  bookId, 
  bookTitle,
  onCopySelect,
  selectedCopyId,
  onIssueBook
}) => {
  const { data: availableCopies, isLoading, error, refetch } = useAvailableBookCopies(bookId);
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);

  console.log('Available copies data:', availableCopies);

  const handleFixMissingCopies = async () => {
    try {
      toast({
        title: 'Creating Missing Copies',
        description: 'Please wait while we create missing book copies...',
      });
      
      const result = await fixMissingBookCopies();
      console.log('Fix missing copies result:', result);
      
      toast({
        title: 'Success',
        description: 'Missing book copies have been created successfully.',
      });
      
      // Refresh the data
      refetch();
    } catch (error) {
      console.error('Error fixing missing copies:', error);
      toast({
        title: 'Error',
        description: 'Failed to create missing book copies. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const displayTrackingCode = (copy: any) => {
    // Always use tracking_code first, fallback to generated format if needed
    if (copy.tracking_code) {
      return copy.tracking_code;
    }
    // Fallback if no tracking_code (shouldn't happen with current data)
    return `${copy.book_code || copy.books?.book_code || 'COPY'}/${String(copy.copy_number).padStart(3, '0')}`;
  };

  const handleIssueClick = (copy: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the copy selection
    if (onIssueBook) {
      onIssueBook(copy);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Available Copies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading available copies...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Available Copies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 mb-4">Error loading available copies: {error.message}</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter copies for the specific book if bookId is provided
  const filteredCopies = bookId 
    ? availableCopies?.filter(copy => copy.book_id === bookId) || []
    : availableCopies || [];

  // Group copies by book if showing all available copies
  const copiesByBook = filteredCopies.reduce((acc, copy) => {
    const book = copy.books;
    if (book) {
      const bookKey = book.id;
      if (!acc[bookKey]) {
        acc[bookKey] = {
          book: book,
          copies: []
        };
      }
      acc[bookKey].copies.push(copy);
    }
    return acc;
  }, {} as Record<string, { book: any; copies: any[] }>);

  const bookGroups = Object.values(copiesByBook);
  
  // Calculate pagination
  const totalItems = bookId ? filteredCopies.length : bookGroups.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  // Get paginated data - separate logic for different cases
  const paginatedIndividualCopies = bookId ? filteredCopies.slice(startIndex, endIndex) : [];
  const paginatedBookGroups = !bookId ? bookGroups.slice(startIndex, endIndex) : [];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Available Copies
          {bookTitle && <span className="text-sm font-normal text-gray-600">for "{bookTitle}"</span>}
        </CardTitle>
        <CardDescription>
          {filteredCopies.length} available cop{filteredCopies.length !== 1 ? 'ies' : 'y'}
          {!bookId && bookGroups.length > 0 && ` across ${bookGroups.length} book${bookGroups.length !== 1 ? 's' : ''}`}
          {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {filteredCopies.length === 0 ? (
          <div className="text-center p-6">
            <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">
              {bookId ? 'No available copies for this book.' : 'No available copies found.'}
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleFixMissingCopies} variant="outline" size="sm">
                Fix Missing Copies
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {bookId ? (
              // Show copies for specific book (paginated)
              <div className="grid gap-2">
                {paginatedIndividualCopies.map((copy) => (
                  <div 
                    key={copy.id} 
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedCopyId === copy.id 
                        ? 'bg-blue-50 border-blue-300' 
                        : 'bg-green-50 hover:bg-green-100'
                    }`}
                    onClick={() => onCopySelect?.(copy)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-medium text-green-800">
                          📚 {displayTrackingCode(copy)}
                        </span>
                        <Badge variant="outline" className="bg-blue-100 text-blue-800">
                          {copy.condition || 'good'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800">
                          Available
                        </Badge>
                        {onIssueBook && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleIssueClick(copy, e)}
                            className="ml-2"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Issue Book
                          </Button>
                        )}
                      </div>
                    </div>
                    {copy.notes && (
                      <p className="text-sm text-gray-600 mt-2">📝 {copy.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // Show copies grouped by book (paginated)
              <div className="space-y-4">
                {paginatedBookGroups.map(({ book, copies }) => (
                  <div key={book.id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="font-medium text-gray-900 mb-2">
                      {book.title} by {book.author}
                    </div>
                    <div className="grid gap-2">
                      {copies.map((copy: any) => (
                        <div 
                          key={copy.id} 
                          className={`border rounded-lg p-2 cursor-pointer transition-colors ${
                            selectedCopyId === copy.id 
                              ? 'bg-blue-50 border-blue-300' 
                              : 'bg-white hover:bg-green-50'
                          }`}
                          onClick={() => onCopySelect?.(copy)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-medium text-green-800">
                              📚 {displayTrackingCode(copy)}
                            </span>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                                {copy.condition || 'good'}
                              </Badge>
                              <Badge className="bg-green-100 text-green-800">
                                Available
                              </Badge>
                              {onIssueBook && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => handleIssueClick(copy, e)}
                                  className="ml-2"
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Issue
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="pt-4 border-t">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => handlePageChange(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleFixMissingCopies} variant="outline" size="sm">
                Fix Missing Copies
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AvailableCopiesCard;
