
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCreateBookCopies } from '@/hooks/useBookCopies';
import { useCreateSystemLog } from '@/hooks/useSystemLogs';
import type { Tables, TablesInsert, TablesUpdate, Database } from '@/integrations/supabase/types';

type Book = Tables<'books'>;
type BookInsert = TablesInsert<'books'>;
type BookUpdate = TablesUpdate<'books'>;

// Function to fetch all records with pagination
const fetchAllRecords = async <T>(
  table: 'books' | 'categories' | 'students', // Explicitly list allowed tables
  select = '*',
  orderBy = 'id' as const
): Promise<T[]> => {
  const limit = 1000; // Max records per request
  let offset = 0;
  let allRecords: T[] = [];
  let hasMore = true;

  while (hasMore) {
    let query;
    
    switch (table) {
      case 'books':
        query = supabase.from('books').select(select);
        break;
      case 'categories':
        query = supabase.from('categories').select(select);
        break;
      case 'students':
        query = supabase.from('students').select(select);
        break;
      default:
        throw new Error(`Unsupported table: ${table}`);
    }
    
    const response = await query
      .order(orderBy, { ascending: true })
      .range(offset, offset + limit - 1);

    if (response.error) throw response.error;
    
    if (response.data) {
      allRecords = [...allRecords, ...(response.data as unknown as T[])];
    }
    
    // If we got fewer records than the limit, we've reached the end
    if (!response.data || response.data.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return allRecords;
};

export const useBooks = () => {
  return useQuery({
    queryKey: ['books'],
    queryFn: async () => {
      console.log('Fetching all books...');
      
      try {
        // Get all books with pagination handling
        const books = await fetchAllRecords<Book>('books', '*', 'id');
        
        // Get all categories
        const categories = await fetchAllRecords<Tables<'categories'>>('categories', '*', 'id');

        // Manually join the data
        const booksWithCategories = books.map(book => ({
          ...book,
          categories: categories?.find(cat => cat.id === book.category_id) || null
        }));
        
        console.log('Books fetched successfully:', booksWithCategories.length);
        return booksWithCategories;
      } catch (error) {
        console.error('Error in useBooks:', error);
        throw error;
      }
    },
  });
};

export const useCreateBook = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createBookCopies = useCreateBookCopies();
  const createLog = useCreateSystemLog();

  return useMutation({
    mutationFn: async (book: BookInsert) => {
      console.log('Creating book:', book);
      
      // First create the book without worrying about copies
      const { data, error } = await supabase
        .from('books')
        .insert({
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          publisher: book.publisher,
          publication_year: book.publication_year,
          category_id: book.category_id,
          description: book.description,
          genre: book.genre,
          shelf_location: book.shelf_location,
          condition: book.condition || 'good',
          book_code: book.book_code,
          total_copies: book.total_copies || 1,
          available_copies: book.total_copies || 1
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating book:', error);
        throw error;
      }

      // Create individual book copies with tracking codes if book_code is provided
      if (book.book_code && book.total_copies) {
        try {
          await createBookCopies.mutateAsync({
            bookId: data.id,
            totalCopies: book.total_copies,
            bookCode: book.book_code
          });
        } catch (copyError) {
          console.error('Error creating book copies:', copyError);
          // Don't fail the whole operation if copy creation fails
        }
      }

      console.log('Book created successfully:', data);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-copies'] });
      
      // Log the action
      createLog.mutate({
        action_type: 'book_created',
        resource_type: 'book',
        resource_id: data.id,
        details: {
          title: variables.title,
          author: variables.author,
          book_code: variables.book_code,
          total_copies: variables.total_copies
        }
      });
      
      toast({
        title: 'Success',
        description: 'Book created successfully',
      });
    },
    onError: (error) => {
      console.error('Create book mutation error:', error);
      toast({
        title: 'Error',
        description: `Failed to create book: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateBook = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLog = useCreateSystemLog();
  const createBookCopies = useCreateBookCopies();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: BookUpdate & { id: string }) => {
      console.log('Updating book:', id, updates);
      
      // Get current book data to check if total_copies changed
      const { data: currentBook } = await supabase
        .from('books')
        .select('total_copies, book_code')
        .eq('id', id)
        .single();
      
      // Prepare book updates
      const bookUpdates = {
        title: updates.title,
        author: updates.author,
        isbn: updates.isbn,
        publisher: updates.publisher,
        publication_year: updates.publication_year,
        category_id: updates.category_id,
        description: updates.description,
        genre: updates.genre,
        shelf_location: updates.shelf_location,
        condition: updates.condition,
        book_code: updates.book_code,
        total_copies: updates.total_copies,
        available_copies: updates.available_copies
      };

      // Remove undefined values
      Object.keys(bookUpdates).forEach(key => {
        if (bookUpdates[key as keyof typeof bookUpdates] === undefined) {
          delete bookUpdates[key as keyof typeof bookUpdates];
        }
      });
      
      // Update the book
      const { data, error } = await supabase
        .from('books')
        .update(bookUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating book:', error);
        throw error;
      }

      // Handle book copies if total_copies changed or if no copies exist
      if (updates.total_copies && updates.book_code) {
        // Check current number of copies
        const { data: existingCopies } = await supabase
          .from('book_copies')
          .select('id')
          .eq('book_id', id);

        const currentCopiesCount = existingCopies?.length || 0;
        const targetCopies = updates.total_copies;

        // If we need more copies than we have, create the missing ones
        if (targetCopies > currentCopiesCount) {
          try {
            await createBookCopies.mutateAsync({
              bookId: id,
              totalCopies: targetCopies - currentCopiesCount,
              bookCode: updates.book_code,
              startingCopyNumber: currentCopiesCount + 1
            });
          } catch (copyError) {
            console.error('Error creating additional book copies:', copyError);
            // Don't fail the whole operation if copy creation fails
          }
        }
      }
      
      console.log('Book updated successfully:', data);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-copies'] });
      
      // Log the action
      createLog.mutate({
        action_type: 'book_updated',
        resource_type: 'book',
        resource_id: data.id,
        details: {
          title: data.title,
          changes: variables
        }
      });
      
      toast({
        title: 'Success',
        description: 'Book updated successfully',
      });
    },
    onError: (error) => {
      console.error('Update book mutation error:', error);
      toast({
        title: 'Error',
        description: `Failed to update book: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteBook = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLog = useCreateSystemLog();

  return useMutation({
    mutationFn: async (id: string) => {
      // First get book details for logging
      const { data: book } = await supabase
        .from('books')
        .select('title, author, book_code')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting book:', error);
        throw error;
      }

      return { id, book };
    },
    onSuccess: ({ id, book }) => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-copies'] });
      
      // Log the action
      createLog.mutate({
        action_type: 'book_deleted',
        resource_type: 'book',
        resource_id: id,
        details: {
          title: book?.title,
          author: book?.author,
          book_code: book?.book_code
        }
      });
      
      toast({
        title: 'Success',
        description: 'Book deleted successfully',
      });
    },
    onError: (error) => {
      console.error('Delete book mutation error:', error);
      toast({
        title: 'Error',
        description: `Failed to delete book: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};
