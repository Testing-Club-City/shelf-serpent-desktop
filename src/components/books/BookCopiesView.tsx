import React, { useState, useEffect } from 'react';
import { useBookCopies, useCreateBookCopies } from '@/hooks/useBookCopies';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Copy, RefreshCw, Plus, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface BookCopiesViewProps {
  bookId: string;
  bookTitle: string;
  onFixMissingCopies?: () => void;
}

const BookCopiesView: React.FC<BookCopiesViewProps> = ({ 
  bookId, 
  bookTitle,
  onFixMissingCopies 
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const { 
    data: bookCopiesData, 
    isLoading, 
    error, 
    refetch 
  } = useBookCopies({ 
    bookId, 
    page: currentPage, 
    pageSize 
  });
  
  const bookCopies = bookCopiesData?.data || [];
  const totalCopies = bookCopiesData?.total || 0;
  const totalPages = bookCopiesData?.totalPages || 1;
  
  const createBookCopies = useCreateBookCopies();
  const { toast } = useToast();
  const [isAddingCopies, setIsAddingCopies] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Get the book code from the first copy or use a default
  const bookCode = bookCopies?.[0]?.book_code || bookCopies?.[0]?.books?.book_code || '';
  
  // Get the current year (last 2 digits)
  const currentYear = new Date().getFullYear();
  const currentYearShort = currentYear.toString().slice(-2);
  
  // Find the highest copy number to start from
  // We need to fetch the highest copy number separately since we're paginating
  const [highestCopyNumber, setHighestCopyNumber] = useState(0);
  
  useEffect(() => {
    const fetchHighestCopyNumber = async () => {
      const { data, error } = await supabase
        .from('book_copies')
        .select('copy_number')
        .eq('book_id', bookId)
        .order('copy_number', { ascending: false })
        .limit(1)
        .single();
        
      if (!error && data) {
        setHighestCopyNumber(data.copy_number || 0);
      }
    };
    
    if (bookId) {
      fetchHighestCopyNumber();
    }
  }, [bookId]);

  // Professional copy management
  const [startNumber, setStartNumber] = useState<number>(0);
  const [endNumber, setEndNumber] = useState<number>(0);
  const [yearValue, setYearValue] = useState<string>(currentYear.toString());
  const [condition, setCondition] = useState('good');
  const [isOpen, setIsOpen] = useState(false);
  
  // Update start and end numbers when highestCopyNumber changes
  useEffect(() => {
    const newStart = highestCopyNumber + 1;
    setStartNumber(newStart);
    setEndNumber(newStart);
  }, [highestCopyNumber]);
  
  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    // Scroll to top of the component
    const element = document.getElementById('book-copies-table');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  // Handle page size change
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Generate years for dropdown (current year ±10 years)
  const availableYears = Array.from({ length: 21 }, (_, i) => (currentYear - 10 + i).toString());

  // Update end number when start number changes
  useEffect(() => {
    if (startNumber > endNumber) {
      setEndNumber(startNumber);
    }
  }, [startNumber, endNumber]);

  const handleAddCopies = async () => {
    if (!bookId || !bookCode) {
      toast({
        title: 'Error',
        description: 'Missing book information. Cannot add copies.',
        variant: 'destructive',
      });
      return;
    }

    // Calculate number of copies from start to end
    const totalCopies = endNumber - startNumber + 1;
    
    if (totalCopies <= 0) {
      toast({
        title: 'Error',
        description: 'End number must be greater than or equal to start number.',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingCopies(true);
    try {
      // Get last two digits of the year for the tracking code
      const yearForCode = yearValue.slice(-2);

      await createBookCopies.mutateAsync({
        bookId,
        totalCopies,
        bookCode,
        condition,
        startingCopyNumber: startNumber,
        year: yearForCode
      });

      toast({
        title: 'Success',
        description: `Added ${totalCopies} new copies to "${bookTitle}"`,
      });
      
      // Reset form
      setStartNumber(endNumber + 1);
      setEndNumber(endNumber + 1);
      await refetch();
    } catch (error) {
      console.error('Error adding copies:', error);
      toast({
        title: 'Error',
        description: `Failed to add copies: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsAddingCopies(false);
    }
  };

  if (isLoading && currentPage === 1) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Book Copies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4">
            <p className="text-red-600 mb-4">Error loading book copies: {error.message}</p>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const availableCopies = bookCopies?.filter(copy => copy.status === 'available') || [];
  const borrowedCopies = bookCopies?.filter(copy => copy.status === 'borrowed') || [];
  const otherCopies = bookCopies?.filter(copy => !['available', 'borrowed'].includes(copy.status)) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'borrowed': return 'bg-yellow-100 text-yellow-800';
      case 'lost': return 'bg-red-100 text-red-800';
      case 'damaged': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'fair': return 'bg-yellow-100 text-yellow-800';
      case 'poor': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const displayTrackingCode = (copy: any) => {
    // Always use tracking_code first, fallback to generated format if needed
    if (copy.tracking_code) {
      return copy.tracking_code;
    }
    // Use the simplified format: PREFIX/NUMBER/YEAR
    const bookCode = copy.book_code || 'COPY';
    const copyNumber = String(copy.copy_number).padStart(3, '0');
    const year = new Date().getFullYear().toString().slice(-2);
    return `${bookCode}/${copyNumber}/${year}`;
  };

  // Preview what the next tracking codes will look like
  const getPreviewTrackingCodes = () => {
    const yearForCode = yearValue.slice(-2);
    
    if (startNumber === endNumber) {
      return `${bookCode}/${String(startNumber).padStart(3, '0')}/${yearForCode}`;
    } else {
      const first = `${bookCode}/${String(startNumber).padStart(3, '0')}/${yearForCode}`;
      const last = `${bookCode}/${String(endNumber).padStart(3, '0')}/${yearForCode}`;
      return `${first} ... ${last}`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Copy className="h-5 w-5" />
          Book Copies for "{bookTitle}"
        </CardTitle>
        <CardDescription>
          Total: {bookCopies?.length || 0} copies | 
          Available: {availableCopies.length} | 
          Borrowed: {borrowedCopies.length}
          {otherCopies.length > 0 && ` | Other: ${otherCopies.length}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!bookCopies || bookCopies.length === 0 ? (
          <div className="text-center p-6">
            <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">No book copies found for this book.</p>
            {onFixMissingCopies && (
              <Button onClick={onFixMissingCopies} variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Create Missing Copies
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Available Copies */}
            {availableCopies.length > 0 && (
              <div>
                <h4 className="font-semibold text-green-700 mb-2 flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  Available Copies ({availableCopies.length})
                </h4>
                <div className="grid gap-2">
                  {availableCopies.map((copy) => (
                    <div key={copy.id} className="border rounded-lg p-3 bg-green-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-medium text-green-800">
                            📚 {displayTrackingCode(copy)}
                          </span>
                          <Badge variant="outline" className={getConditionColor(copy.condition)}>
                            {copy.condition || 'good'}
                          </Badge>
                        </div>
                        <Badge className={getStatusColor(copy.status)}>
                          {copy.status}
                        </Badge>
                      </div>
                      {copy.notes && (
                        <p className="text-sm text-gray-600 mt-2">📝 {copy.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Borrowed Copies */}
            {borrowedCopies.length > 0 && (
              <div>
                <h4 className="font-semibold text-yellow-700 mb-2 flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  Borrowed Copies ({borrowedCopies.length})
                </h4>
                <div className="grid gap-2">
                  {bookCopies?.map((copy) => (
                    <div key={copy.id} className="border rounded-lg p-3 bg-yellow-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-medium text-yellow-800">
                            📚 {displayTrackingCode(copy)}
                          </span>
                          <Badge variant="outline" className={getConditionColor(copy.condition)}>
                            {copy.condition || 'good'}
                          </Badge>
                        </div>
                        <Badge className={getStatusColor(copy.status)}>
                          {copy.status}
                        </Badge>
                      </div>
                      {copy.notes && (
                        <p className="text-sm text-gray-600 mt-2">📝 {copy.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other Status Copies */}
            {otherCopies.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  Other Status Copies ({otherCopies.length})
                </h4>
                <div className="grid gap-2">
                  {otherCopies.map((copy) => (
                    <div key={copy.id} className="border rounded-lg p-3 bg-red-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-medium text-red-800">
                            📚 {displayTrackingCode(copy)}
                          </span>
                          <Badge variant="outline" className={getConditionColor(copy.condition)}>
                            {copy.condition || 'good'}
                          </Badge>
                        </div>
                        <Badge className={getStatusColor(copy.status)}>
                          {copy.status}
                        </Badge>
                      </div>
                      {copy.notes && (
                        <p className="text-sm text-gray-600 mt-2">📝 {copy.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Copies Form - Professional Style */}
            <div className="mt-6 border-t pt-4">
              <Collapsible
                open={isOpen}
                onOpenChange={setIsOpen}
                className="w-full"
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add New Copies
                  </h4>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "transform rotate-180" : ""}`} />
                      <span className="sr-only">Toggle</span>
                    </Button>
                  </CollapsibleTrigger>
                </div>
                
                <CollapsibleContent className="mt-2">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="start-number">Start Number</Label>
                        <Input
                          id="start-number"
                          type="number"
                          min="1"
                          value={startNumber}
                          onChange={(e) => setStartNumber(parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="end-number">End Number</Label>
                        <Input
                          id="end-number"
                          type="number"
                          min={startNumber}
                          value={endNumber}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || startNumber;
                            setEndNumber(Math.max(value, startNumber));
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="year">Year</Label>
                        <Select value={yearValue} onValueChange={setYearValue}>
                          <SelectTrigger id="year">
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent className="max-h-64 overflow-auto">
                            {availableYears.map((year) => (
                              <SelectItem key={year} value={year}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="w-1/2">
                        <Label htmlFor="condition">Condition</Label>
                        <Select value={condition} onValueChange={setCondition}>
                          <SelectTrigger id="condition">
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="excellent">Excellent</SelectItem>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="fair">Fair</SelectItem>
                            <SelectItem value="poor">Poor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-end justify-end w-1/2">
                        <Button 
                          onClick={handleAddCopies} 
                          disabled={isAddingCopies || !bookCode || startNumber > endNumber}
                          className="ml-auto"
                        >
                          {isAddingCopies ? (
                            <>
                              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                              Adding...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Copies
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded border">
                      <p>
                        <span className="font-medium">Preview:</span> {getPreviewTrackingCodes()}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium">Total copies to add:</span> {endNumber - startNumber + 1}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium">Current highest copy number:</span> {highestCopyNumber}
                      </p>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {onFixMissingCopies && (
                <Button onClick={onFixMissingCopies} variant="outline" size="sm">
                  <Copy className="h-4 w-4 mr-2" />
                  Fix Missing Copies
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>

/* ... */
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t" id="pagination-controls">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min((currentPage - 1) * pageSize + 1, totalCopies)}-
            {Math.min(currentPage * pageSize, totalCopies)} of {totalCopies} copies
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={currentPage === 1}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <Button key={pageNum} variant={currentPage === pageNum ? 'default' : 'outline'} size="sm" onClick={() => handlePageChange(pageNum)} className="w-10">
                  {pageNum}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePageChange(totalPages)} disabled={currentPage >= totalPages}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default BookCopiesView;
