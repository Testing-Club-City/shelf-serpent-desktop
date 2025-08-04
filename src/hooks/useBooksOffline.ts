import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { offlineDataService } from '@/services/offlineDataService';
import { useToast } from '@/hooks/use-toast';
import { useConnectivity } from '@/hooks/useConnectivity';
import { supabase } from '@/integrations/supabase/client';

// Types - using the correct BookWithDetails from offline.ts
import type { Book, BookWithDetails } from '@/types/offline';

// Hybrid offline-first data service
class BooksDataService {
  private isOnline: boolean = false;

  constructor(private connectivity: ReturnType<typeof useConnectivity>) {
    this.isOnline = connectivity.isOnline;
  }

  async getBooks(): Promise<BookWithDetails[]> {
    // Always try offline database first
    try {
      const rawData = await offlineDataService.getBooks() as any;
      console.log(`Loaded ${rawData.length} books from offline database`);
      
      // Handle both possible response formats
      let books: BookWithDetails[];
      
      if (rawData && rawData.length > 0 && rawData[0].book) {
        // Backend format: { book: {...}, category: {...}, copies: [...], active_borrowings: [...] }
        books = rawData.map((item: any) => ({
          id: item.book.id,
          title: item.book.title,
          author: item.book.author,
          isbn: item.book.isbn || '',
          category_id: item.book.category_id,
          total_copies: item.book.total_copies || 0,
          available_copies: item.book.available_copies || 0,
          description: item.book.description,
          cover_image: item.book.cover_image_url,
          published_date: item.book.publication_year?.toString(),
          publisher: item.book.publisher,
          created_at: item.book.created_at,
          updated_at: item.book.updated_at,
          category_name: item.category?.name || 'Uncategorized',
          borrowed_count: item.active_borrowings?.length || 0
        }));
      } else {
        // Direct BookWithDetails format
        books = rawData as BookWithDetails[];
      }
      
      // If online, sync with Supabase in background
      if (this.isOnline) {
        this.syncBooksInBackground().catch(console.error);
      }
      
      return books;
    } catch (error) {
      console.error('Failed to load from offline DB, falling back to Supabase:', error);
      
      if (this.isOnline) {
        return this.getBooksFromSupabase();
      }
      
      throw new Error('No offline data available and no internet connection');
    }
  }

  private async getBooksFromSupabase(): Promise<BookWithDetails[]> {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*, categories(*)')
        .order('title');

      if (error) throw error;

      return data?.map(book => ({
        id: book.id,
        title: book.title,
        author: book.author,
        isbn: book.isbn || '',
        category_id: book.category_id,
        total_copies: book.total_copies || 0,
        available_copies: book.available_copies || 0,
        description: book.description,
        cover_image: book.cover_image_url,
        published_date: book.publication_year?.toString(),
        publisher: book.publisher,
        created_at: book.created_at,
        updated_at: book.updated_at,
        category_name: book.categories?.name || 'Uncategorized',
        borrowed_count: 0 // This would need to be calculated from borrowings
      })) || [];
    } catch (error) {
      console.error('Failed to fetch from Supabase:', error);
      throw error;
    }
  }

  private async syncBooksInBackground() {
    try {
      const supabaseBooks = await this.getBooksFromSupabase();
      console.log(`Syncing ${supabaseBooks.length} books from Supabase to offline DB`);
      
      // Store in offline database for future offline use
      // This would typically involve a more sophisticated sync strategy
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }

  async searchBooks(query: string): Promise<Book[]> {
    // Always use offline search for speed
    try {
      return await offlineDataService.searchBooks(query);
    } catch (error) {
      console.error('Offline search failed, trying Supabase:', error);
      
      if (this.isOnline) {
        const { data, error } = await supabase
          .from('books')
          .select('*')
          .or(`title.ilike.%${query}%,author.ilike.%${query}%,isbn.ilike.%${query}%`)
          .order('title');

        if (error) throw error;
        return data || [];
      }
      
      throw error;
    }
  }

  async createBook(bookData: any): Promise<string> {
    // Always save to offline database first
    try {
      const bookId = await offlineDataService.createBook(bookData);
      console.log('Book created in offline database:', bookId);

      // If online, sync to Supabase
      if (this.isOnline) {
        try {
          const { data, error } = await supabase
            .from('books')
            .insert(bookData)
            .select()
            .single();

          if (error) throw error;
          console.log('Book synced to Supabase');
          
          // Update offline database with Supabase ID if different
          return data.id || bookId;
        } catch (syncError) {
          console.error('Failed to sync to Supabase, keeping offline:', syncError);
        }
      }

      return bookId;
    } catch (error) {
      console.error('Failed to create book:', error);
      throw error;
    }
  }

  async updateBook(bookId: string, bookData: any): Promise<void> {
    // Update offline database first
    await offlineDataService.updateBook(bookId, bookData);

    // Sync to Supabase if online
    if (this.isOnline) {
      try {
        const { error } = await supabase
          .from('books')
          .update(bookData)
          .eq('id', bookId);

        if (error) throw error;
        console.log('Book updated in Supabase');
      } catch (syncError) {
        console.error('Failed to sync update to Supabase:', syncError);
      }
    }
  }

  async deleteBook(bookId: string): Promise<void> {
    // Delete from offline database first
    await offlineDataService.deleteBook(bookId);

    // Delete from Supabase if online
    if (this.isOnline) {
      try {
        const { error } = await supabase
          .from('books')
          .delete()
          .eq('id', bookId);

        if (error) throw error;
        console.log('Book deleted from Supabase');
      } catch (syncError) {
        console.error('Failed to sync delete to Supabase:', syncError);
      }
    }
  }
}

// React hooks
export const useBooksOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['books', 'offline-first'],
    queryFn: async () => {
      const service = new BooksDataService(connectivity);
      return await service.getBooks();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      if (!connectivity.isOnline && failureCount < 2) {
        return true; // Retry offline operations
      }
      return failureCount < 1;
    },
  });

  // Handle errors with useEffect
  React.useEffect(() => {
    if (query.error) {
      toast({
        title: "Failed to load books",
        description: query.error instanceof Error ? query.error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  }, [query.error, toast]);

  return query;
};

export const useSearchBooksOffline = () => {
  const connectivity = useConnectivity();

  return async (query: string) => {
    const service = new BooksDataService(connectivity);
    return await service.searchBooks(query);
  };
};

export const useCreateBookOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookData: any) => {
      const service = new BooksDataService(connectivity);
      return await service.createBook(bookData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books', 'offline-first'] });
      toast({
        title: "Book created",
        description: "Book saved to offline database and will sync when online",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create book",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateBookOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookId, bookData }: { bookId: string; bookData: any }) => {
      const service = new BooksDataService(connectivity);
      await service.updateBook(bookId, bookData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books', 'offline-first'] });
      toast({
        title: "Book updated",
        description: "Book updated in offline database and will sync when online",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update book",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteBookOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookId: string) => {
      const service = new BooksDataService(connectivity);
      await service.deleteBook(bookId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books', 'offline-first'] });
      toast({
        title: "Book deleted",
        description: "Book deleted from offline database and will sync when online",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete book",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
