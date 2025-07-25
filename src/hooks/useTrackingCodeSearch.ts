import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

interface TrackingCodeSearchResult {
  id: string;
  tracking_code: string;
  book_id: string;
  copy_number: number;
  condition: string;
  status: string;
  books: {
    id: string;
    title: string;
    author: string;
    book_code: string;
    isbn: string;
    total_copies: number;
    available_copies: number;
  };
}

interface ProgressiveSearchResult {
  type: 'none' | 'book_code' | 'book_copies' | 'exact';
  data: any;
  searchTerm: string;
}

export const useTrackingCodeSearch = (searchTerm: string) => {
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  return useQuery({
    queryKey: ['tracking-code-progressive-search', debouncedSearchTerm],
    queryFn: async (): Promise<ProgressiveSearchResult> => {
      if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
        return { type: 'none', data: null, searchTerm: debouncedSearchTerm };
      }

      const upperSearchTerm = debouncedSearchTerm.toUpperCase();
      console.log('Progressive search for:', upperSearchTerm);

      // First, try exact match by tracking code
      const { data: exactMatch } = await supabase
        .from('book_copies')
        .select(`
          *,
          books (
            id,
            title,
            author,
            book_code,
            isbn,
            total_copies,
            available_copies
          )
        `)
        .eq('tracking_code', upperSearchTerm)
        .eq('status', 'available')
        .single();

      if (exactMatch) {
        console.log('Found exact match by tracking code:', exactMatch.tracking_code);
        return { type: 'exact', data: exactMatch, searchTerm: upperSearchTerm };
      }

      // If no exact match by tracking code, try legacy book ID
      const legacyBookId = parseInt(debouncedSearchTerm);
      if (!isNaN(legacyBookId)) {
        const { data: legacyMatch } = await supabase
          .from('book_copies')
          .select(`
            *,
            books (
              id,
              title,
              author,
              book_code,
              isbn,
              total_copies,
              available_copies
            )
          `)
          .eq('legacy_book_id', legacyBookId)
          .eq('status', 'available')
          .single();

        if (legacyMatch) {
          console.log('Found exact match by legacy book ID:', legacyMatch.legacy_book_id);
          return { type: 'exact', data: legacyMatch, searchTerm: debouncedSearchTerm };
        }
      }

      // If no exact match, look for partial matches
      const { data: partialMatches, error } = await supabase
        .from('book_copies')
        .select(`
          *,
          books (
            id,
            title,
            author,
            book_code,
            isbn,
            total_copies,
            available_copies
          )
        `)
        .ilike('tracking_code', `${upperSearchTerm}%`)
        .eq('status', 'available')
        .order('tracking_code')
        .limit(20);

      if (error) {
        console.error('Error in progressive search:', error);
        throw error;
      }

      if (partialMatches && partialMatches.length > 0) {
        // Analyze search pattern
        const parts = upperSearchTerm.split('/');
        
        if (parts.length === 1) {
          // Just book code (e.g., "KID2")
          const bookGroups = partialMatches.reduce((acc, copy) => {
            const bookId = copy.book_id;
            if (!acc[bookId]) {
              acc[bookId] = {
                book: copy.books,
                copies: [],
                totalCopies: 0
              };
            }
            acc[bookId].copies.push(copy);
            acc[bookId].totalCopies++;
            return acc;
          }, {} as Record<string, any>);

          console.log('Book code search - found', Object.keys(bookGroups).length, 'books');
          return { type: 'book_code', data: bookGroups, searchTerm: upperSearchTerm };
          
        } else if (parts.length === 2) {
          // Book code + copy number prefix (e.g., "KID2/004")
          console.log('Book copies search - found', partialMatches.length, 'copies');
          return { type: 'book_copies', data: partialMatches, searchTerm: upperSearchTerm };
        }
      }

      console.log('No matches found');
      return { type: 'none', data: null, searchTerm: upperSearchTerm };
    },
    enabled: !!debouncedSearchTerm && debouncedSearchTerm.length >= 2,
    staleTime: 30000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};