import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, Plus, Search, Filter, Edit, Trash2, Eye, Tag, RefreshCw, AlertCircle } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { SimpleBookForm } from './SimpleBookForm';
import { BookDetails } from './BookDetails';
import { CategoryManagement } from '../admin/CategoryManagement';
import { useToast } from '@/hooks/use-toast';
import { invoke } from '@tauri-apps/api/core';
import { logBook } from '@/lib/activityLogger';

// Pagination UI components
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface BookManagementProps {
  searchTerm: string;
  openAddBookForm?: boolean;
}

export const BookManagement = ({ searchTerm, openAddBookForm = false }: BookManagementProps) => {
  // Use local database via Tauri commands
  const [displayBooks, setDisplayBooks] = useState<any[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  
  useEffect(() => {
    const loadLocalBooks = async () => {
      try {
        const localBooks = await invoke('get_books');
        setDisplayBooks(localBooks || []);
      } catch (error) {
        console.error('Failed to load local books:', error);
        setDisplayBooks([]);
      } finally {
        setIsLoadingBooks(false);
      }
    };
    
    loadLocalBooks();
  }, []);
  const { data: categories } = useCategories();
  // Removed Supabase hooks - using Tauri commands instead
  const { toast } = useToast();

  // State for book code repair
  const [isRepairingCodes, setIsRepairingCodes] = useState(false);
  const [missingCodesCount, setMissingCodesCount] = useState(0);

  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCategoryManagementOpen, setIsCategoryManagementOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [localSearchTerm, setLocalSearchTerm] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Reset page when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [localSearchTerm, filterCategory, filterStatus]);

  // Open add book form if requested
  useEffect(() => {
    if (openAddBookForm) {
      setIsFormOpen(true);
    }
  }, [openAddBookForm]);

  // Use local search term if provided, otherwise use the one from props
  const activeSearchTerm = localSearchTerm || searchTerm;

  // Count books with missing codes
  useEffect(() => {
    if (displayBooks) {
      const booksWithoutCodes = displayBooks.filter(book => !(book as any).book_code || (book as any).book_code.trim() === '');
      setMissingCodesCount(booksWithoutCodes.length);
    }
  }, [displayBooks]);

  const filteredBooks = displayBooks?.filter(book => {
    const searchTermLower = activeSearchTerm.toLowerCase();
    const matchesSearch = activeSearchTerm === '' ||
      (book.title && book.title.toLowerCase().includes(searchTermLower)) ||
      (book.author && book.author.toLowerCase().includes(searchTermLower)) ||
      (book.isbn && book.isbn.toLowerCase().includes(searchTermLower)) ||
      ((book as any).book_code && (book as any).book_code.toLowerCase().includes(searchTermLower)) ||
      ((book as any).legacy_book_id && (book as any).legacy_book_id.toString().includes(activeSearchTerm));

    const matchesCategory = filterCategory === 'all' || 
      ('category_id' in book ? book.category_id === filterCategory : 
       book.categories?.id === filterCategory);

    let matchesStatus = true;
    if (filterStatus !== 'all') {
      if (filterStatus === 'available') {
        matchesStatus = book.available_copies > 0;
      } else if (filterStatus === 'borrowed') {
        matchesStatus = book.available_copies < book.total_copies && book.available_copies >= 0;
      } else if (filterStatus === 'unavailable') {
        matchesStatus = book.available_copies === 0;
      }
    }

    return matchesSearch && matchesCategory && matchesStatus;
  }) || [];

  // Pagination calculations
  const totalItems = filteredBooks.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  if (currentPage !== validCurrentPage) {
    setCurrentPage(validCurrentPage);
  }
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentItems = filteredBooks.slice(startIndex, endIndex);

  // Generate pagination items (max 5 visible pages)
  const generatePaginationItems = () => {
    const items = [] as React.ReactNode[];
    const maxVisiblePages = 5;

    // Always show first page
    items.push(
      <PaginationItem key="first">
        <PaginationLink
          isActive={validCurrentPage === 1}
          onClick={(e) => {
            e.preventDefault();
            setCurrentPage(1);
          }}
        >
          1
        </PaginationLink>
      </PaginationItem>
    );

    let startPage = Math.max(2, validCurrentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 2);

    if (endPage - startPage < maxVisiblePages - 2) {
      startPage = Math.max(2, endPage - (maxVisiblePages - 2));
    }

    if (startPage > 2) {
      items.push(
        <PaginationItem key="ellipsis-start">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            isActive={validCurrentPage === i}
            onClick={(e) => {
              e.preventDefault();
              setCurrentPage(i);
            }}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (endPage < totalPages - 1) {
      items.push(
        <PaginationItem key="ellipsis-end">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    if (totalPages > 1) {
      items.push(
        <PaginationItem key="last">
          <PaginationLink
            isActive={validCurrentPage === totalPages}
            onClick={(e) => {
              e.preventDefault();
              setCurrentPage(totalPages);
            }}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  const handleCreateBook = async (data: any) => {
    try {
      // Use the new command that creates book with copies automatically
      const bookId = await invoke('create_book_with_copies', { bookData: data });
      
      // Log the activity
      await logBook.added(bookId as string, data.title);
      
      setIsFormOpen(false);
      toast({
        title: 'Success',
        description: `Book created successfully with ${data.total_copies || data.generated_codes?.length || 1} copy(ies)`,
      });
      
      // Refresh local books data
      const localBooks = await invoke('get_books');
      setDisplayBooks(localBooks || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create book',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateBook = async (data: any) => {
    if (!selectedBook) return;
    try {
      await invoke('update_book', { bookId: selectedBook.id, bookData: data });
      
      // Log the activity
      await logBook.updated(selectedBook.id, data.title, data);
      
      setIsFormOpen(false);
      setSelectedBook(null);
      toast({
        title: 'Success',
        description: 'Book updated successfully',
      });
      
      // Refresh local books data
      const localBooks = await invoke('get_books');
      setDisplayBooks(localBooks || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update book',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteBook = async (id: string) => {
    try {
      // Find the book to get its title for logging
      const book = displayBooks.find(b => b.id === id);
      
      await invoke('delete_book', { bookId: id });
      
      // Log the activity
      if (book) {
        await logBook.deleted(id, book.title);
      }
      
      toast({
        title: 'Success',
        description: 'Book deleted successfully',
      });
      
      // Refresh local books data
      const localBooks = await invoke('get_books');
      setDisplayBooks(localBooks || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete book',
        variant: 'destructive',
      });
    }
  };

  // Function to generate and assign book codes
  const generateMissingBookCodes = async () => {
    setIsRepairingCodes(true);
    try {
      // Use Tauri command to fix book codes
      await invoke('fix_missing_book_codes');
      
      toast({
        title: 'Book Codes Generated!',
        description: 'Successfully generated missing book codes',
      });
      
      // Refresh local books data
      const localBooks = await invoke('get_books');
      setDisplayBooks(localBooks || []);
      
    } catch (error: any) {
      console.error('Error generating book codes:', error);
      toast({
        title: 'Error',
        description: `Failed to generate book codes: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsRepairingCodes(false);
    }
  };

  // Helper function to display book code with better formatting
  const displayBookCode = (book: any) => {
    if (book.book_code && book.book_code.trim() !== '') {
      return book.book_code;
    }
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="w-3 h-3" />
        <span className="text-xs">Missing</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" />
            Book Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your library collection • {filteredBooks.length} of {displayBooks?.length || 0} books
          </p>
        </div>
        <div className="flex gap-2">
          {missingCodesCount > 0 && (
            <Button 
              variant="outline" 
              onClick={generateMissingBookCodes}
              disabled={isRepairingCodes}
              className="flex items-center gap-2 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
            >
              {isRepairingCodes ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              Fix {missingCodesCount} Missing Codes
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => setIsCategoryManagementOpen(true)} 
            className="flex items-center gap-2"
          >
            <Tag className="w-4 h-4" />
            Manage Categories
          </Button>
          <Button onClick={() => setIsFormOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Books
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search books by title, author, ISBN, or book code..."
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="borrowed">Borrowed</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>

              {/* Items per page selector */}
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Items per page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Books Table */}
      <Card>
        <CardHeader>
          <CardTitle>Books Collection</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingBooks ? (
            <div className="text-center py-8">Loading books...</div>
          ) : filteredBooks.length > 0 ? (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Copies</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.map((book) => (
                  <TableRow key={book.id}>
                    <TableCell className="font-mono text-sm">
                      {displayBookCode(book)}
                    </TableCell>
                    <TableCell className="font-medium">{book.title}</TableCell>
                    <TableCell>{book.author}</TableCell>
                    <TableCell>
                      {(book as any).categories?.name && (
                        <Badge variant="outline">{(book as any).categories.name}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">{book.available_copies}</span>
                        <span className="text-muted-foreground">/{book.total_copies}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        (book as any).status === 'available' ? 'default' :
                        (book as any).status === 'unavailable' ? 'destructive' : 'secondary'
                      }>
                        {(book as any).status || 'unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBook(book);
                            setIsDetailsOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBook(book);
                            setIsFormOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBook(book.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-500">
                Showing {startIndex + 1} to {endIndex} of {totalItems} books
              </div>
              <Pagination className="border rounded-md p-1 bg-gray-50">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage((prev) => Math.max(1, prev - 1));
                      }}
                      className={validCurrentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>

                  {generatePaginationItems()}

                  <PaginationItem>
                    <PaginationNext
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                      }}
                      className={validCurrentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
            </>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No books found</h3>
              <p className="text-muted-foreground mb-4">
                {activeSearchTerm || filterCategory !== 'all' || filterStatus !== 'all'
                  ? 'No books match your current filters.'
                  : 'Start building your library by adding your first book.'
                }
              </p>
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Book
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Book Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedBook ? 'Edit Book' : 'Add New Books'}
            </DialogTitle>
          </DialogHeader>
          <SimpleBookForm
            book={selectedBook}
            onSubmit={selectedBook ? handleUpdateBook : handleCreateBook}
            onCancel={() => {
              setIsFormOpen(false);
              setSelectedBook(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Book Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Details</DialogTitle>
          </DialogHeader>
          {selectedBook && (
            <BookDetails
              book={selectedBook}
              onClose={() => {
                setIsDetailsOpen(false);
                setSelectedBook(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Category Management Component */}
      <CategoryManagement
        isOpen={isCategoryManagementOpen}
        onOpenChange={setIsCategoryManagementOpen}
      />
    </div>
  );
};
