
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useBook = (id?: string) => {
  return useQuery({
    queryKey: ['book', id],
    queryFn: async () => {
      if (!id) throw new Error('Book ID is required');
      
      console.log('Fetching book with ID:', id);
      
      // Get the book first
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .single();
      
      if (bookError) {
        console.error('Error fetching book:', bookError);
        throw bookError;
      }

      // Get the category separately if book has a category_id
      let category = null;
      if (book.category_id) {
        const { data: categoryData, error: categoryError } = await supabase
          .from('categories')
          .select('*')
          .eq('id', book.category_id)
          .single();
        
        if (!categoryError && categoryData) {
          category = categoryData;
        }
      }

      // Return book with category manually joined
      const result = {
        ...book,
        categories: category
      };
      
      console.log('Book fetched successfully:', result);
      return result;
    },
    enabled: !!id,
  });
};
