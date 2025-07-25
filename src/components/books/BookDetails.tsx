import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, Edit, ArrowLeft, Download, Printer, BookCopy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBook } from '@/hooks/useBook';
import { useCategories } from '@/hooks/useCategories';
import { useBookCopies } from '@/hooks/useBookCopies';
import { useBorrowings } from '@/hooks/useBorrowings';
import { useUpdateBook } from '@/hooks/useBooks';
import { EnhancedBookForm } from './EnhancedBookForm';
import BookCopiesView from './BookCopiesView';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface BookDetailsProps {
  book?: any;
  onClose?: () => void;
}

export const BookDetails = ({ book: propBook, onClose }: BookDetailsProps) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('details');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const { data: categories } = useCategories();
  const { data: bookCopiesData } = useBookCopies({ bookId: propBook?.id });
  const { data: borrowingsData } = useBorrowings();
  const updateBook = useUpdateBook();
  
  // Extract bookCopies array from the data structure
  const bookCopies = bookCopiesData?.data || [];
  
  // Use the book from props if provided
  const book = propBook;
  
  // Extract borrowings array from the data structure
  const allBorrowings = borrowingsData?.data || [];
  
  // Filter borrowings for this book
  const bookBorrowings = allBorrowings.filter(borrowing => borrowing.book_id === book?.id);
  
  // Get active borrowings count
  const activeBorrowings = bookBorrowings.filter(borrowing => borrowing.status === 'active').length;
  
  // Calculate availability percentage
  const availabilityPercentage = book?.total_copies > 0 
    ? Math.round((book.available_copies / book.total_copies) * 100) 
    : 0;
  
  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <BookOpen className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Book Not Found</h2>
        <p className="text-gray-600 mb-6">The book you're looking for doesn't exist or has been removed.</p>
        {onClose && (
          <Button onClick={onClose}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Books
          </Button>
        )}
      </div>
    );
  }
  
  const handleUpdateBook = async (updatedBookData: any) => {
    try {
      await updateBook.mutateAsync({
        id: book.id,
        ...updatedBookData
      });
      setIsEditDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Book updated successfully',
      });
    } catch (error) {
      console.error('Error updating book:', error);
      toast({
        title: 'Error',
        description: 'Failed to update book. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  const getCategoryName = (categoryId: string) => {
    return categories?.find(c => c.id === categoryId)?.name || 'Uncategorized';
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'borrowed':
        return 'bg-blue-100 text-blue-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      case 'lost':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getBorrowingStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'returned':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Function to print book details
  const handlePrintDetails = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'Error',
        description: 'Could not open print window. Please check your popup blocker settings.',
        variant: 'destructive',
      });
      return;
    }

    // Format book details for printing
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Book Details: ${book.title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { margin-bottom: 5px; }
          .author { color: #666; margin-bottom: 20px; }
          .section { margin-bottom: 15px; }
          .label { font-weight: bold; color: #555; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f2f2f2; }
          .copies { margin-top: 30px; }
          .copy-item { padding: 8px; border: 1px solid #eee; margin-bottom: 5px; }
          .status-available { color: green; }
          .status-borrowed { color: orange; }
          .status-lost { color: red; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>${book.title}</h1>
        <div class="author">by ${book.author}</div>
        
        <div class="section">
          <span class="label">ISBN:</span> ${book.isbn || 'Not specified'}
        </div>
        <div class="section">
          <span class="label">Book Code:</span> ${book.book_code || 'Not specified'}
        </div>
        <div class="section">
          <span class="label">Publisher:</span> ${book.publisher || 'Not specified'}
        </div>
        <div class="section">
          <span class="label">Publication Year:</span> ${book.publication_year || 'Not specified'}
        </div>
        <div class="section">
          <span class="label">Genre:</span> ${book.genre || 'Not specified'}
        </div>
        <div class="section">
          <span class="label">Category:</span> ${getCategoryName(book.category_id)}
        </div>
        <div class="section">
          <span class="label">Shelf Location:</span> ${book.shelf_location || 'Not specified'}
        </div>
        <div class="section">
          <span class="label">Status:</span> ${book.status}
        </div>
        <div class="section">
          <span class="label">Total Copies:</span> ${book.total_copies || 0}
        </div>
        <div class="section">
          <span class="label">Available Copies:</span> ${book.available_copies || 0}
        </div>
        
        ${book.description ? `
        <div class="section">
          <span class="label">Description:</span><br>
          ${book.description}
        </div>
        ` : ''}
        
        <div class="copies">
          <h2>Book Copies</h2>
          ${bookCopies && bookCopies.length > 0 ? `
            <table>
              <tr>
                <th>Tracking Code</th>
                <th>Status</th>
                <th>Condition</th>
              </tr>
              ${bookCopies.map(copy => `
                <tr>
                  <td>${copy.tracking_code || `${copy.book_code}/${String(copy.copy_number).padStart(3, '0')}`}</td>
                  <td class="status-${copy.status}">${copy.status}</td>
                  <td>${copy.condition || 'good'}</td>
                </tr>
              `).join('')}
            </table>
          ` : '<p>No copies found for this book.</p>'}
        </div>
        
        <div style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()">Print</button>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Auto-trigger print dialog
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // Function to export book data as CSV
  const handleExportData = () => {
    // Format book data for CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Add header row
    csvContent += "Title,Author,ISBN,Book Code,Publisher,Publication Year,Genre,Category,Shelf Location,Status,Total Copies,Available Copies,Description\n";
    
    // Add book data
    csvContent += `"${book.title}","${book.author}","${book.isbn || ''}","${book.book_code || ''}","${book.publisher || ''}","${book.publication_year || ''}","${book.genre || ''}","${getCategoryName(book.category_id)}","${book.shelf_location || ''}","${book.status}","${book.total_copies || 0}","${book.available_copies || 0}","${(book.description || '').replace(/"/g, '""')}"\n`;
    
    // Add copies data if needed
    if (bookCopies && bookCopies.length > 0) {
      csvContent += "\nCopy Number,Tracking Code,Status,Condition,Notes\n";
      bookCopies.forEach(copy => {
        const trackingCode = copy.tracking_code || `${copy.book_code}/${String(copy.copy_number).padStart(3, '0')}`;
        csvContent += `"${copy.copy_number}","${trackingCode}","${copy.status}","${copy.condition || 'good'}","${(copy.notes || '').replace(/"/g, '""')}"\n`;
      });
    }
    
    // Create a download link and trigger the download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `book_${book.book_code || book.id}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: 'Success',
      description: 'Book data exported successfully',
    });
  };

  // Function to print barcode labels
  const handlePrintBarcodeLabels = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'Error',
        description: 'Could not open print window. Please check your popup blocker settings.',
        variant: 'destructive',
      });
      return;
    }

    // Format barcode labels for printing
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Book Barcode Labels: ${book.title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
          .page { page-break-after: always; }
          .labels-container { display: flex; flex-wrap: wrap; }
          .label { 
            width: 2.625in; 
            height: 1in; 
            padding: 0.125in; 
            margin: 0.05in; 
            border: 1px solid #ddd; 
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .book-title { font-size: 10pt; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .book-author { font-size: 8pt; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .tracking-code { 
            font-family: monospace; 
            font-size: 12pt; 
            font-weight: bold; 
            text-align: center;
            padding: 5px;
            border: 1px solid #000;
            background: #f9f9f9;
          }
          .barcode-placeholder {
            text-align: center;
            border: 1px dashed #ccc;
            padding: 5px;
            margin-top: 5px;
            font-size: 8pt;
          }
          .print-button {
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
          @media print {
            .print-button { display: none; }
          }
        </style>
      </head>
      <body>
        <button class="print-button" onclick="window.print()">Print</button>
        <div class="page">
          <div class="labels-container">
            ${bookCopies && bookCopies.length > 0 ? 
              bookCopies.map(copy => {
                const trackingCode = copy.tracking_code || `${copy.book_code}/${String(copy.copy_number).padStart(3, '0')}/${new Date().getFullYear().toString().slice(-2)}`;
                return `
                  <div class="label">
                    <div>
                      <div class="book-title">${book.title}</div>
                      <div class="book-author">by ${book.author}</div>
                    </div>
                    <div class="tracking-code">${trackingCode}</div>
                    <div class="barcode-placeholder">
                      ${trackingCode}
                    </div>
                  </div>
                `;
              }).join('') 
              : '<p>No copies found for this book.</p>'
            }
          </div>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Auto-trigger print dialog
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Books
            </Button>
          )}
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{book.title}</h1>
          <p className="text-gray-600">by {book.author}</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrintDetails}>
            <Printer className="mr-2 h-4 w-4" />
            Print Details
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportData}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button size="sm" onClick={() => setIsEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Book
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Book Information</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="copies">Copies</TabsTrigger>
                <TabsTrigger value="borrowings">Borrowing History</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">ISBN</h3>
                    <p className="mt-1">{book.isbn || 'Not specified'}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Tracking Code</h3>
                    <div className="mt-1">
                      {book.book_code ? (
                        <Badge variant="outline" className="font-mono bg-blue-50">
                          {book.book_code}
                        </Badge>
                      ) : (
                        'Not specified'
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Publisher</h3>
                    <p className="mt-1">{book.publisher || 'Not specified'}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Publication Year</h3>
                    <p className="mt-1">{book.publication_year || 'Not specified'}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Genre</h3>
                    <p className="mt-1">{book.genre || 'Not specified'}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Category</h3>
                    <p className="mt-1">{getCategoryName(book.category_id)}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Shelf Location</h3>
                    <p className="mt-1">{book.shelf_location || 'Not specified'}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Status</h3>
                    <div className="mt-1">
                      <Badge className={getStatusColor(book.status)}>
                        {book.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                {book.description && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Description</h3>
                    <p className="mt-1 text-gray-700">{book.description}</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="copies" className="mt-4">
                <BookCopiesView 
                  bookId={book.id} 
                  bookTitle={book.title} 
                />
              </TabsContent>
              
              <TabsContent value="borrowings" className="mt-4">
                {bookBorrowings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Book Copy</TableHead>
                          <TableHead>Borrowed Date</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Returned Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookBorrowings.map((borrowing) => (
                          <TableRow key={borrowing.id}>
                            <TableCell>
                              <div className="font-medium">
                                {borrowing.students?.first_name} {borrowing.students?.last_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {borrowing.students?.admission_number}
                              </div>
                            </TableCell>
                            <TableCell>
                              {borrowing.book_copies ? (
                                <div className="space-y-1">
                                  <div className="font-medium text-sm">
                                    Copy #{borrowing.book_copies.copy_number}
                                  </div>
                                  {borrowing.book_copies.tracking_code && (
                                    <Badge variant="outline" className="text-xs font-mono">
                                      {borrowing.book_copies.tracking_code}
                                    </Badge>
                                  )}
                                </div>
                              ) : borrowing.tracking_code ? (
                                <div className="space-y-1">
                                  <div className="text-sm text-gray-600">
                                    General borrowing
                                  </div>
                                  <Badge variant="outline" className="text-xs font-mono bg-gray-50">
                                    {borrowing.tracking_code}
                                  </Badge>
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500">
                                  <div>Legacy borrowing</div>
                                  <div className="text-xs">No copy tracking</div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>{borrowing.borrowed_date}</TableCell>
                            <TableCell>{borrowing.due_date}</TableCell>
                            <TableCell>{borrowing.returned_date || '—'}</TableCell>
                            <TableCell>
                              <Badge className={getBorrowingStatusColor(borrowing.status)}>
                                {borrowing.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <p className="text-gray-500">No borrowing history found for this book</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {book.available_copies} of {book.total_copies} copies available
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      {availabilityPercentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${availabilityPercentage}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-2">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Copies</p>
                    <p className="text-2xl font-bold">{book.total_copies}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Currently Borrowed</p>
                    <p className="text-2xl font-bold">{activeBorrowings}</p>
                  </div>
                </div>
                
                <Button className="w-full" onClick={() => setActiveTab('copies')}>
                  <BookCopy className="mr-2 h-4 w-4" />
                  Manage Copies
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={handlePrintBarcodeLabels}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print Barcode Labels
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handleExportData}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Book Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Book</DialogTitle>
          </DialogHeader>
          <EnhancedBookForm
            book={book}
            onSubmit={handleUpdateBook}
            onCancel={() => setIsEditDialogOpen(false)}
            categories={categories}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
