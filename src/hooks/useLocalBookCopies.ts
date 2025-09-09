import { useQuery } from '@tanstack/react-query';
import { getBookCopiesByBookId } from '@/lib/api';

export const useLocalBookCopies = (bookId?: string) => {
  return useQuery({
    queryKey: ['local-book-copies', bookId],
    queryFn: async () => {
      if (!bookId) {
        return {
          data: [],
          total: 0,
          available: 0,
          borrowed: 0
        };
      }

      try {
        console.log('🔍 Fetching book copies for book ID:', bookId);
        const bookCopies = await getBookCopiesByBookId(bookId);
        console.log('✅ Received book copies:', bookCopies);
        
        // Calculate statistics
        const total = bookCopies.length;
        const available = bookCopies.filter(copy => copy.status === 'available').length;
        const borrowed = bookCopies.filter(copy => copy.status === 'borrowed').length;
        
        return {
          data: bookCopies,
          total,
          available,
          borrowed
        };
      } catch (error) {
        console.error('❌ Failed to fetch book copies:', error);
        // Return empty state instead of throwing error
        return {
          data: [],
          total: 0,
          available: 0,
          borrowed: 0
        };
      }
    },
    enabled: !!bookId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Only retry once to avoid spamming
  });
};