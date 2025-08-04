import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, BookOpen, Tag, Loader2, Eye, ArrowLeft, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import { useCategoriesOffline, useCreateCategoryOffline, useUpdateCategoryOffline, useDeleteCategoryOffline } from '@/hooks/useCategoriesOffline';
import { useBooksOffline } from '@/hooks/useBooksOffline';
import { useToast } from '@/hooks/use-toast';

interface CategoryManagementProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CategoryManagement = ({ isOpen, onOpenChange }: CategoryManagementProps) => {
  // Use offline-first hooks for better performance and offline capability
  const { data: categories = [], isLoading, refetch } = useCategoriesOffline();
  const { data: books = [] } = useBooksOffline();
  const createCategory = useCreateCategoryOffline();
  const updateCategory = useUpdateCategoryOffline();
  const deleteCategory = useDeleteCategoryOffline();
  const { toast } = useToast();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [viewingCategoryBooks, setViewingCategoryBooks] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [booksPerPage] = useState(10);
  const [booksTableRef, setBooksTableRef] = useState<HTMLDivElement | null>(null);
  const [categoriesTableRef, setCategoriesTableRef] = useState<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  // Get book count for each category
  const getCategoryBookCount = (categoryId: string) => {
    return books.filter(book => book.category_id === categoryId).length;
  };

  // Get books for a specific category with pagination
  const getCategoryBooks = (categoryId: string) => {
    return books.filter(book => book.category_id === categoryId);
  };

  // Get paginated books for current page
  const getPaginatedBooks = (categoryBooks: any[]) => {
    const startIndex = (currentPage - 1) * booksPerPage;
    const endIndex = startIndex + booksPerPage;
    return categoryBooks.slice(startIndex, endIndex);
  };

  // Calculate total pages
  const getTotalPages = (totalBooks: number) => {
    return Math.ceil(totalBooks / booksPerPage);
  };

  // Reset form data
  const resetForm = () => {
    setFormData({ name: '', description: '' });
  };

  // Handle create category
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createCategory.mutateAsync({
        name: formData.name.trim(),
        description: formData.description.trim() || null
      });
      
      resetForm();
      setIsAddDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to create category: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  // Handle edit category
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCategory || !formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateCategory.mutateAsync({
        categoryId: selectedCategory.id,
        categoryData: {
          name: formData.name.trim(),
          description: formData.description.trim() || null
        }
      });
      
      resetForm();
      setIsEditDialogOpen(false);
      setSelectedCategory(null);
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to update category: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  // Handle delete category
  const handleDelete = async () => {
    if (!selectedCategory) return;

    const bookCount = getCategoryBookCount(selectedCategory.id);
    
    if (bookCount > 0) {
      toast({
        title: 'Cannot Delete Category',
        description: `Cannot delete "${selectedCategory.name}" because it has ${bookCount} books assigned to it. Please reassign or remove the books first.`,
        variant: 'destructive',
      });
      setIsDeleteDialogOpen(false);
      setSelectedCategory(null);
      return;
    }

    try {
      await deleteCategory.mutateAsync(selectedCategory.id);
      setIsDeleteDialogOpen(false);
      setSelectedCategory(null);
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to delete category: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  // Open edit dialog with category data
  const openEditDialog = (category: any) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      description: category.description || ''
    });
    setIsEditDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (category: any) => {
    setSelectedCategory(category);
    setIsDeleteDialogOpen(true);
  };

  // Open add dialog
  const openAddDialog = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  // Reset to first page when viewing different category books
  const viewCategoryBooks = (category: any) => {
    setCurrentPage(1);
    setViewingCategoryBooks(category);
  };

  // Scroll functions for books table
  const scrollToTop = () => {
    if (booksTableRef) {
      booksTableRef.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    if (booksTableRef) {
      // Use a small timeout to ensure the DOM is fully rendered
      setTimeout(() => {
        booksTableRef.scrollTo({ 
          top: booksTableRef.scrollHeight + 100, 
          behavior: 'smooth' 
        });
      }, 100);
    }
  };

  const scrollUp = () => {
    if (booksTableRef) {
      booksTableRef.scrollBy({ top: -300, behavior: 'smooth' });
    }
  };

  const scrollDown = () => {
    if (booksTableRef) {
      booksTableRef.scrollBy({ top: 300, behavior: 'smooth' });
    }
  };

  // Scroll functions for categories table
  const scrollCategoriesToTop = () => {
    if (categoriesTableRef) {
      categoriesTableRef.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollCategoriesToBottom = () => {
    if (categoriesTableRef) {
      // Use a small timeout to ensure the DOM is fully rendered
      setTimeout(() => {
        categoriesTableRef.scrollTo({ 
          top: categoriesTableRef.scrollHeight + 100, 
          behavior: 'smooth' 
        });
      }, 100);
    }
  };

  const scrollCategoriesUp = () => {
    if (categoriesTableRef) {
      categoriesTableRef.scrollBy({ top: -300, behavior: 'smooth' });
    }
  };

  const scrollCategoriesDown = () => {
    if (categoriesTableRef) {
      categoriesTableRef.scrollBy({ top: 300, behavior: 'smooth' });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {viewingCategoryBooks ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewingCategoryBooks(null)}
                    className="mr-2 p-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <BookOpen className="w-5 h-5" />
                  Books in "{viewingCategoryBooks.name}"
                </>
              ) : (
                <>
                  <Tag className="w-5 h-5" />
                  Manage Book Categories
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
            {viewingCategoryBooks ? (
              /* Books List View */
              <div className="flex flex-col space-y-4 min-h-0 flex-1">
                {/* Back Button and Category Info */}
                <div className="flex items-center justify-between border-b pb-4 flex-shrink-0">
                  <div>
                    <h3 className="text-lg font-semibold">{viewingCategoryBooks.name}</h3>
                    <p className="text-sm text-gray-600">
                      {viewingCategoryBooks.description || 'No description'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(() => {
                        const totalBooks = getCategoryBooks(viewingCategoryBooks.id).length;
                        const totalPages = getTotalPages(totalBooks);
                        return totalPages > 1 
                          ? `${totalBooks} books • Page ${currentPage} of ${totalPages}`
                          : `${totalBooks} books in this category`;
                      })()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setViewingCategoryBooks(null)}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Categories
                  </Button>
                </div>

                {/* Books Table */}
                <div className="flex flex-col space-y-4 flex-1 min-h-0">
                  <div className="flex items-center justify-between flex-shrink-0">
                    <h4 className="text-md font-medium text-gray-900">Books List</h4>
                    
                    {/* Scroll Controls */}
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500 mr-2">Quick scroll:</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={scrollToTop}
                        className="h-8 w-8 p-0"
                        title="Scroll to top"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={scrollUp}
                        className="h-8 w-8 p-0"
                        title="Scroll up"
                      >
                        <ChevronLeft className="w-3 h-3 rotate-90" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={scrollDown}
                        className="h-8 w-8 p-0"
                        title="Scroll down"
                      >
                        <ChevronRight className="w-3 h-3 rotate-90" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={scrollToBottom}
                        className="h-8 w-8 p-0"
                        title="Scroll to bottom"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <Card className="flex-1 min-h-0">
                    <CardContent className="p-0 h-full">
                      <div 
                        ref={setBooksTableRef}
                        className="h-full overflow-y-auto scrollbar-thin"
                        style={{
                          scrollbarWidth: 'thin',
                          scrollbarColor: '#cbd5e1 #f1f5f9',
                          maxHeight: 'calc(85vh - 250px)'
                        }}
                      >
                        {(() => {
                          const categoryBooks = getCategoryBooks(viewingCategoryBooks.id);
                          const paginatedBooks = getPaginatedBooks(categoryBooks);
                          
                          if (categoryBooks.length === 0) {
                            return (
                              <div className="text-center py-8">
                                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No Books in This Category</h3>
                                <p className="text-gray-500 mb-4">
                                  Books assigned to "{viewingCategoryBooks.name}" will appear here
                                </p>
                              </div>
                            );
                          }

                          return (
                            <Table>
                              <TableHeader className="sticky top-0 bg-white z-10 border-b">
                                <TableRow>
                                  <TableHead>Title</TableHead>
                                  <TableHead>Author</TableHead>
                                  <TableHead>ISBN</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Added</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {paginatedBooks.map((book, index) => (
                                  <TableRow 
                                    key={book.id}
                                    className="hover:bg-gray-50 transition-colors"
                                  >
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-6">
                                          {((currentPage - 1) * booksPerPage) + index + 1}
                                        </span>
                                        <BookOpen className="w-4 h-4 text-green-600" />
                                        <span className="truncate max-w-xs" title={book.title}>
                                          {book.title}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <span className="truncate max-w-xs block" title={book.author}>
                                        {book.author}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                                        {book.isbn || 'N/A'}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge 
                                        variant={book.available_copies > 0 ? 'default' : 'outline'}
                                        className={book.available_copies > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                                      >
                                        {book.available_copies > 0 ? 'Available' : 'Unavailable'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm text-gray-500">
                                        {new Date(book.created_at).toLocaleDateString()}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {/* Add some bottom padding */}
                                <TableRow className="h-4">
                                  <TableCell colSpan={5} className="p-0"></TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pagination Controls */}
                  {(() => {
                    const categoryBooks = getCategoryBooks(viewingCategoryBooks.id);
                    const totalPages = getTotalPages(categoryBooks.length);
                    
                    if (totalPages <= 1) return null;

                    return (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t flex-shrink-0">
                        <div className="text-sm text-gray-500">
                          Showing {((currentPage - 1) * booksPerPage) + 1} to {Math.min(currentPage * booksPerPage, categoryBooks.length)} of {categoryBooks.length} books
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCurrentPage(currentPage - 1);
                              scrollToTop();
                            }}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1"
                          >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                          </Button>
                          
                          <div className="flex items-center space-x-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                              // Show first, last, current, and adjacent pages
                              const showPage = page === 1 || 
                                             page === totalPages || 
                                             Math.abs(page - currentPage) <= 1;
                              
                              if (!showPage) {
                                // Show ellipsis for gaps
                                if (page === currentPage - 2 || page === currentPage + 2) {
                                  return <span key={page} className="px-2 text-gray-400">...</span>;
                                }
                                return null;
                              }

                              return (
                                <Button
                                  key={page}
                                  variant={currentPage === page ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => {
                                    setCurrentPage(page);
                                    scrollToTop();
                                  }}
                                  className="w-8 h-8 p-0"
                                >
                                  {page}
                                </Button>
                              );
                            })}
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCurrentPage(currentPage + 1);
                              scrollToTop();
                            }}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1"
                          >
                            Next
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              /* Categories List View */
              <div className="flex flex-col space-y-4 min-h-0 flex-1">
                {/* Header with Add Button */}
                <div className="flex items-center justify-between flex-shrink-0">
                  <div>
                    <p className="text-sm text-gray-600">
                      Organize your books by creating and managing categories
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {categories.length} categories • {books.length} total books
                    </p>
                  </div>
                  <Button onClick={openAddDialog} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Category
                  </Button>
                </div>

                {/* Categories Scroll Controls */}
                {categories.length > 5 && (
                  <div className="flex items-center justify-between flex-shrink-0">
                    <h4 className="text-md font-medium text-gray-900">Categories List</h4>
                    
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500 mr-2">Quick scroll:</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={scrollCategoriesToTop}
                        className="h-8 w-8 p-0"
                        title="Scroll to top"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={scrollCategoriesUp}
                        className="h-8 w-8 p-0"
                        title="Scroll up"
                      >
                        <ChevronLeft className="w-3 h-3 rotate-90" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={scrollCategoriesDown}
                        className="h-8 w-8 p-0"
                        title="Scroll down"
                      >
                        <ChevronRight className="w-3 h-3 rotate-90" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={scrollCategoriesToBottom}
                        className="h-8 w-8 p-0"
                        title="Scroll to bottom"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Categories Table - only show when not viewing category books */}
            {!viewingCategoryBooks && (
              <Card className="flex-1 min-h-0">
                <CardContent className="p-0 h-full">
                  <div 
                    ref={setCategoriesTableRef}
                    className="h-full overflow-y-auto scrollbar-thin"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#cbd5e1 #f1f5f9',
                      maxHeight: 'calc(85vh - 200px)'
                    }}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        Loading categories...
                      </div>
                    ) : categories.length === 0 ? (
                      <div className="text-center py-8">
                        <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Categories Yet</h3>
                        <p className="text-gray-500 mb-4">Create your first category to organize your books</p>
                        <Button onClick={openAddDialog}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Your First Category
                        </Button>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader className="sticky top-0 bg-white z-10 border-b">
                          <TableRow>
                            <TableHead>Category Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Books Count</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categories.map((category, index) => {
                            const bookCount = getCategoryBookCount(category.id);
                            return (
                              <TableRow 
                                key={category.id}
                                className="hover:bg-gray-50 transition-colors"
                              >
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400 w-6">
                                      {index + 1}
                                    </span>
                                    <Tag className="w-4 h-4 text-blue-600" />
                                    <span className="truncate max-w-xs" title={category.name}>
                                      {category.name}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-gray-600 truncate max-w-xs block" title={category.description || 'No description'}>
                                    {category.description || 'No description'}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={bookCount > 0 ? 'default' : 'outline'}
                                    className={bookCount > 0 ? "cursor-pointer hover:bg-blue-700 transition-colors" : ""}
                                    onClick={() => {
                                      if (bookCount > 0) {
                                        viewCategoryBooks(category);
                                      }
                                    }}
                                  >
                                    <BookOpen className="w-3 h-3 mr-1" />
                                    {bookCount} book{bookCount !== 1 ? 's' : ''}
                                    {bookCount > 0 && <Eye className="w-3 h-3 ml-1" />}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-gray-500">
                                    {new Date(category.created_at).toLocaleDateString()}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEditDialog(category)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openDeleteDialog(category)}
                                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {/* Add some bottom padding */}
                          <TableRow className="h-4">
                            <TableCell colSpan={5} className="p-0"></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label htmlFor="add_name">Category Name *</Label>
              <Input
                id="add_name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Fiction, Science, History"
                required
              />
            </div>
            <div>
              <Label htmlFor="add_description">Description</Label>
              <Textarea
                id="add_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description for this category"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createCategory.isPending}
              >
                {createCategory.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Category'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <Label htmlFor="edit_name">Category Name *</Label>
              <Input
                id="edit_name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Fiction, Science, History"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description for this category"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateCategory.isPending}
              >
                {updateCategory.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  'Update Category'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category "{selectedCategory?.name}"? 
              {getCategoryBookCount(selectedCategory?.id || '') > 0 && (
                <span className="text-red-600 font-medium">
                  <br />This category has {getCategoryBookCount(selectedCategory?.id || '')} books assigned to it.
                </span>
              )}
              <br />This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteCategory.isPending}
            >
              {deleteCategory.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete Category'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
