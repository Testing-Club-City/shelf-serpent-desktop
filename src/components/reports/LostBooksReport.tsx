import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLostBooks } from '@/hooks/useLostBooks';
import { useFines, usePayFine, useClearFine, useCollectFine } from '@/hooks/useFineManagement';
import { BookX, Download, Search, AlertTriangle, UserRound, FileText, Printer, Currency, X, CheckCircle, RefreshCw, BookMarked, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClasses } from '@/hooks/useClasses';
import { formatCurrency } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useReturnBorrowing } from '@/hooks/useBorrowings';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LostBooksReportProps {
  onGeneratePDF?: () => void;
}

interface StudentLostBooksEntry {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
    class_grade: string;
  };
  books: any[];
  totalFine: number;
}

export const LostBooksReport = ({ onGeneratePDF }: LostBooksReportProps) => {
  const { data: lostBooks, isLoading, error } = useLostBooks();
  const { data: fines } = useFines();
  const { data: classes } = useClasses();
  const payFine = usePayFine();
  const clearFine = useClearFine();
  const collectFine = useCollectFine();
  const returnBorrowing = useReturnBorrowing();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'books' | 'students' | 'fines'>('books');
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'return' | 'replace' | null>(null);
  const [processingAction, setProcessingAction] = useState(false);
  
  // Pagination states
  const [booksCurrentPage, setBooksCurrentPage] = useState(1);
  const [studentsCurrentPage, setStudentsCurrentPage] = useState(1);
  const [finesCurrentPage, setFinesCurrentPage] = useState(1);
  const itemsPerPage = 10;

  console.log('Lost books data:', lostBooks);
  console.log('Lost books loading:', isLoading);
  console.log('Lost books error:', error);
  console.log('All fines data:', fines);
  console.log('All fines count:', fines?.length);
  
  // Show error state if there's an error
  if (error) {
    console.error('Error loading lost books:', error);
  }

  // Filter lost books based on search term and class
  const filteredBooks = lostBooks?.filter(book => {
    const matchesSearch = 
      book.books?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.books?.author?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.books?.isbn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.tracking_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.students?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.students?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.students?.admission_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesClass = selectedClass === 'all' || 
      book.students?.class_grade === selectedClass;
    
    return matchesSearch && matchesClass;
  }) || [];

  // Filter fines - show ALL fines now, not just lost book fines
  const filteredFines = fines?.filter(fine => {
    const matchesSearch = 
      fine.students?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fine.students?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fine.students?.admission_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fine.borrowings?.books?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fine.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fine.fine_type?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesClass = selectedClass === 'all' || 
      fine.students?.class_grade === selectedClass;
    
    return matchesSearch && matchesClass;
  }) || [];

  console.log('All filtered fines:', filteredFines.length, filteredFines);

  // Calculate total replacement cost (sum of fines from lost books)
  const totalReplacementCost = filteredBooks.reduce((sum, book) => {
    // Only count books with a recorded fine
    const fine = book.fine_amount || 0;
    return sum + (fine > 0 ? fine : 0);
  }, 0);

  // Calculate total outstanding fines for ALL fines (not just lost books)
  const totalOutstandingFines = filteredFines
    .filter(fine => fine.status === 'unpaid')
    .reduce((sum, fine) => sum + (fine.amount || 0), 0);

  const groupBooksByStudent = (books: any[]) => {
    return books.reduce((acc: Record<string, StudentLostBooksEntry>, book) => {
      const studentId = book.students?.id;
      if (!studentId) return acc;
      
      if (!acc[studentId]) {
        acc[studentId] = {
          student: book.students,
          books: [],
          totalFine: 0
        };
      }
      
      acc[studentId].books.push(book);
      acc[studentId].totalFine += book.fine_amount || 0;
      
      return acc;
    }, {});
  };

  const convertToSortedArray = (groupedBooks: Record<string, StudentLostBooksEntry>): StudentLostBooksEntry[] => {
    return Object.values(groupedBooks).sort((a, b) => 
      `${a.student?.last_name || ''} ${a.student?.first_name || ''}`.localeCompare(
        `${b.student?.last_name || ''} ${b.student?.first_name || ''}`
      )
    );
  };

  const studentLostBooks = convertToSortedArray(groupBooksByStudent(filteredBooks));

  // Pagination logic
  const paginateData = (data: any[], currentPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (dataLength: number) => {
    return Math.ceil(dataLength / itemsPerPage);
  };

  const generatePageNumbers = (totalPages: number, currentPage: number) => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  // Paginated data
  const paginatedBooks = paginateData(filteredBooks, booksCurrentPage);
  const paginatedStudents = paginateData(studentLostBooks, studentsCurrentPage);
  const paginatedFines = paginateData(filteredFines, finesCurrentPage);

  // Simple pagination component
  const SimplePagination = ({ 
    totalItems, 
    currentPage, 
    onPageChange 
  }: { 
    totalItems: number;
    currentPage: number;
    onPageChange: (page: number) => void;
  }) => {
    const totalPages = getTotalPages(totalItems);
    
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between mt-4 px-2">
        <div className="text-sm text-gray-500">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex items-center gap-1">
            {generatePageNumbers(totalPages, currentPage).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
                className="min-w-[2rem]"
              >
                {page}
              </Button>
            ))}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const handleFineAction = async (fineId: string, action: string, amount?: number) => {
    try {
      switch (action) {
        case 'pay':
          await payFine.mutateAsync(fineId);
          break;
        case 'clear':
          await clearFine.mutateAsync(fineId);
          break;
        case 'collect':
          if (amount) {
            await collectFine.mutateAsync({ fineId, amountCollected: amount });
          }
          break;
      }
    } catch (error) {
      console.error('Fine action failed:', error);
    }
  };

  const openActionDialog = (book: any, action: 'return' | 'replace') => {
    setSelectedBook(book);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const handleBookAction = async () => {
    if (!selectedBook || !actionType) return;
    
    setProcessingAction(true);
    try {
      if (actionType === 'return') {
        // Handle returning a lost book
        if (selectedBook.borrowing_id) {
          // For books lost during borrowing
          await returnBorrowing.mutateAsync({
            id: selectedBook.borrowing_id,
            condition_at_return: 'fair', // Default condition for returned lost books
            fine_amount: selectedBook.fine_amount, // Keep the fine amount
            notes: 'Book was found and returned',
            is_lost: false // Mark as not lost anymore
          });
          toast({
            title: "Book Returned",
            description: "The lost book has been marked as returned successfully.",
          });
        } else {
          // For directly lost book copies (no borrowing record)
          const { error } = await supabase
            .from('book_copies')
            .update({ 
              status: 'available',
              condition: 'fair',
              notes: 'Recovered from lost status'
            })
            .eq('id', selectedBook.id);
            
          if (error) {
            throw new Error(`Failed to update book copy: ${error.message}`);
          }
          
          // Update the book's available copies count
          const { data: bookData, error: getBookError } = await supabase
            .from('books')
            .select('available_copies, id')
            .eq('id', selectedBook.books.id)
            .single();
            
          if (!getBookError && bookData) {
            const currentAvailable = bookData.available_copies || 0;
            const newAvailable = currentAvailable + 1;
            
            await supabase
              .from('books')
              .update({
                available_copies: newAvailable,
                updated_at: new Date().toISOString()
              })
              .eq('id', bookData.id);
          }
          
          toast({
            title: "Book Recovered",
            description: "The lost book copy has been marked as available.",
          });
        }
      } else if (actionType === 'replace') {
        // Handle replacing a lost book
        if (selectedBook.borrowing_id) {
          // For books lost during borrowing
          // First mark the borrowing as returned and fine paid
          await returnBorrowing.mutateAsync({
            id: selectedBook.borrowing_id,
            condition_at_return: 'replaced', 
            fine_amount: selectedBook.fine_amount, // Keep the fine amount
            notes: 'Book was replaced with a new copy',
            is_lost: false // Mark as not lost anymore
          });
        }
        
        // Then create a new book copy to replace the lost one
        if (selectedBook.books) {
          const { data: bookData } = await supabase
            .from('books')
            .select('total_copies, available_copies')
            .eq('id', selectedBook.books.id)
            .single();
            
          if (bookData) {
            // Update the book's total and available copies
            await supabase
              .from('books')
              .update({
                total_copies: (bookData.total_copies || 0) + 1,
                available_copies: (bookData.available_copies || 0) + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', selectedBook.books.id);
              
            // Create a new book copy
            const { error: copyError } = await supabase
              .from('book_copies')
              .insert({
                book_id: selectedBook.books.id,
                copy_number: selectedBook.copy_number + 1,
                book_code: selectedBook.books.book_code,
                status: 'available',
                condition: 'new',
                notes: 'Replacement for lost copy'
              });
              
            if (copyError) {
              console.error('Error creating replacement copy:', copyError);
            }
          }
        }
        
        toast({
          title: "Book Replaced",
          description: "The lost book has been marked as replaced and a new copy has been added.",
        });
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['lost-books'] });
      queryClient.invalidateQueries({ queryKey: ['borrowings'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-copies'] });
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      
      setActionDialogOpen(false);
    } catch (error) {
      console.error('Book action failed:', error);
      toast({
        title: "Action Failed",
        description: `Failed to process book: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setProcessingAction(false);
      setSelectedBook(null);
      setActionType(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <BookX className="w-5 h-5 animate-pulse text-red-600" />
          <span className="text-muted-foreground">Loading lost books...</span>
        </div>
      </div>
    );
  }

  return (
    <Card className="print:shadow-none">
      <CardHeader className="bg-red-50 print:bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-red-100 p-2 rounded-full print:bg-white">
              <BookX className="h-5 w-5 text-red-600" />
            </div>
            <CardTitle className="text-red-800 print:text-black">Lost Books & All Fines Report</CardTitle>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-white">
              {filteredBooks.length} lost books
            </Badge>
            <Badge variant="outline" className="bg-white">
              {filteredFines.length} fines
            </Badge>
          </div>
        </div>
        
        {/* Debug info - remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <div>Debug: Total fines in system: {fines?.length || 0}</div>
            <div>All fines shown: {filteredFines.length}</div>
            <div>Lost books: {filteredBooks.length}</div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4 print:hidden">
          <div className="flex flex-1 gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search lost books, students, or fines..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes?.map(cls => (
                  <SelectItem key={cls.id} value={cls.class_name}>{cls.class_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 self-end sm:self-auto">
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!filteredBooks.length && !filteredFines.length}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            {onGeneratePDF && (
              <Button variant="default" size="sm" onClick={onGeneratePDF} disabled={!filteredBooks.length && !filteredFines.length} className="bg-green-600 hover:bg-green-700 text-white">
                <FileText className="h-4 w-4 mr-2" />
                Generate PDF
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="books" className="print:hidden" onValueChange={(value) => setViewMode(value as 'books' | 'students' | 'fines')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="books" className="flex items-center gap-2">
              <BookX className="h-4 w-4" />
              Lost Books ({filteredBooks.length})
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2">
              <UserRound className="h-4 w-4" />
              Students ({studentLostBooks.length})
            </TabsTrigger>
            <TabsTrigger value="fines" className="flex items-center gap-2">
              <Currency className="h-4 w-4" />
              All Fines ({filteredFines.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="books">
            {filteredBooks.length > 0 ? (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Book Title</TableHead>
                        <TableHead>Tracking Code</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Lost Date</TableHead>
                        <TableHead className="text-right">Replacement Cost (KSh)</TableHead>
                        <TableHead>Fine Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedBooks.map((book) => (
                        <TableRow key={book.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{book.books?.title || 'Unknown Title'}</div>
                              <div className="text-sm text-gray-500">{book.books?.author || 'Unknown Author'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {book.tracking_code || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {book.students ? (
                              <div>
                                <div>{book.students.first_name} {book.students.last_name}</div>
                                <div className="text-xs text-gray-500">{book.students.admission_number}</div>
                              </div>
                            ) : (
                              <span className="text-gray-500">Unknown</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {book.students?.class_grade || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            {book.lost_date ? (
                              format(new Date(book.lost_date), 'MMM d, yyyy')
                            ) : (
                              <span className="text-gray-500">Unknown</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {book.fine_amount && book.fine_amount > 0
                              ? formatCurrency(book.fine_amount)
                              : <span className="text-gray-400">—</span>
                            }
                          </TableCell>
                          <TableCell>
                            {book.fine_amount && book.fine_amount > 0 ? (
                              <Badge className="bg-green-100 text-green-800">Fine Recorded</Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-800">No Fine Recorded</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-700"
                                onClick={() => openActionDialog(book, 'return')}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Return
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600 hover:text-blue-700"
                                onClick={() => openActionDialog(book, 'replace')}
                              >
                                <BookMarked className="h-3 w-3 mr-1" />
                                Replace
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                <SimplePagination 
                  totalItems={filteredBooks.length}
                  currentPage={booksCurrentPage}
                  onPageChange={setBooksCurrentPage}
                />
                
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-800">Total Replacement Cost</span>
                    </div>
                    <span className="text-lg font-bold text-red-800">{formatCurrency(totalReplacementCost)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 border rounded-md bg-gray-50">
                <BookX className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">No Lost Books Found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {error ? 'Error loading lost books data. Please try refreshing the page.' : 'There are currently no books marked as lost in the system.'}
                </p>
                {error && (
                  <p className="mt-2 text-xs text-red-600">
                    Error: {error.message}
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="students">
            {studentLostBooks.length > 0 ? (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Admission No.</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Books Lost</TableHead>
                        <TableHead>Book Titles</TableHead>
                        <TableHead className="text-right">Total Fine (KSh)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedStudents.map((entry, index) => (
                        <TableRow key={entry.student?.id || index}>
                          <TableCell>
                            <div className="font-medium">
                              {entry.student?.first_name} {entry.student?.last_name}
                            </div>
                          </TableCell>
                          <TableCell>
                            {entry.student?.admission_number}
                          </TableCell>
                          <TableCell>
                            {entry.student?.class_grade || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-200">
                              {entry.books.length} {entry.books.length === 1 ? 'book' : 'books'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[200px] truncate">
                              {entry.books.map(book => book.books?.title || 'Unknown').join(', ')}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(entry.totalFine)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                <SimplePagination 
                  totalItems={studentLostBooks.length}
                  currentPage={studentsCurrentPage}
                  onPageChange={setStudentsCurrentPage}
                />
                
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-800">
                        {studentLostBooks.length} Students with Lost Books
                      </span>
                    </div>
                    <span className="text-lg font-bold text-red-800">{formatCurrency(totalReplacementCost)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 border rounded-md bg-gray-50">
                <UserRound className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">No Students with Lost Books</h3>
                <p className="mt-1 text-sm text-gray-500">
                  There are currently no students who have lost books in the system.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="fines">
            {filteredFines.length > 0 ? (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Book/Description</TableHead>
                        <TableHead>Fine Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedFines.map((fine) => (
                        <TableRow key={fine.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {fine.students?.first_name} {fine.students?.last_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {fine.students?.admission_number} • {fine.students?.class_grade}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {fine.borrowings?.books?.title || fine.description || 'Fine'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {fine.description}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {fine.fine_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(fine.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={
                                fine.status === 'paid' ? 'bg-green-100 text-green-800' :
                                fine.status === 'cleared' ? 'bg-blue-100 text-blue-800' :
                                fine.status === 'collected' ? 'bg-purple-100 text-purple-800' :
                                'bg-red-100 text-red-800'
                              }
                            >
                              {fine.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(fine.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            {fine.status === 'unpaid' && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => handleFineAction(fine.id, 'pay')}
                                  disabled={payFine.isPending}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Pay
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-blue-600 hover:text-blue-700"
                                  onClick={() => handleFineAction(fine.id, 'clear')}
                                  disabled={clearFine.isPending}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Clear
                                </Button>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-purple-600 hover:text-purple-700"
                                    >
                                      <Currency className="h-3 w-3 mr-1" />
                                      Collect
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Collect Fine</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <p>
                                        Collecting fine for {fine.students?.first_name} {fine.students?.last_name}
                                      </p>
                                      <div>
                                        <label className="text-sm font-medium">Amount to Collect (KSh)</label>
                                        <Input
                                          type="number"
                                          defaultValue={fine.amount}
                                          step="0.01"
                                          id={`collect-amount-${fine.id}`}
                                        />
                                      </div>
                                      <div className="flex gap-2 justify-end">
                                        <Button
                                          onClick={() => {
                                            const amountInput = document.getElementById(`collect-amount-${fine.id}`) as HTMLInputElement;
                                            const amount = parseFloat(amountInput.value);
                                            handleFineAction(fine.id, 'collect', amount);
                                          }}
                                          disabled={collectFine.isPending}
                                        >
                                          Collect Fine
                                        </Button>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                <SimplePagination 
                  totalItems={filteredFines.length}
                  currentPage={finesCurrentPage}
                  onPageChange={setFinesCurrentPage}
                />
                
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Currency className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800">Total Outstanding Fines</span>
                    </div>
                    <span className="text-lg font-bold text-orange-800">{formatCurrency(totalOutstandingFines)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 border rounded-md bg-gray-50">
                <Currency className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">No Fines Found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  No fines match your current search criteria.
                </p>
                <div className="mt-4 text-xs text-gray-400 space-y-1">
                  <div>Total fines in system: {fines?.length || 0}</div>
                  <div>All fines are now displayed in this tab</div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Add action dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'return' ? 'Return Lost Book' : 'Replace Lost Book'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'return'
                ? 'Mark this book as found and return it to the library inventory.'
                : 'Mark this book as replaced with a new copy.'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedBook && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Book Title</p>
                  <p className="text-sm">{selectedBook.books?.title}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Tracking Code</p>
                  <p className="text-sm font-mono">{selectedBook.tracking_code}</p>
                </div>
              </div>
              
              {selectedBook.students && (
                <div>
                  <p className="text-sm font-medium mb-1">Student</p>
                  <p className="text-sm">
                    {selectedBook.students.first_name} {selectedBook.students.last_name} ({selectedBook.students.admission_number})
                  </p>
                </div>
              )}
              
              <div>
                <p className="text-sm font-medium mb-1">Fine Amount</p>
                <p className="text-sm">{formatCurrency(selectedBook.fine_amount || 0)}</p>
              </div>
              
              <div className="bg-yellow-50 p-3 rounded-md">
                <p className="text-sm text-yellow-800">
                  {actionType === 'return'
                    ? 'This will mark the book as returned and update the library inventory. The fine will remain for record keeping.'
                    : 'This will mark the book as replaced and add a new copy to the library inventory. The fine will remain for record keeping.'}
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)} disabled={processingAction}>
              Cancel
            </Button>
            <Button 
              onClick={handleBookAction} 
              disabled={processingAction}
              className={actionType === 'return' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
            >
              {processingAction ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {actionType === 'return' ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Return Book
                    </>
                  ) : (
                    <>
                      <BookMarked className="h-4 w-4 mr-2" />
                      Replace Book
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
