import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { useDebounce } from '@/hooks/useDebounce';

interface TrackingCodeSearchResult {
  id: string;
  tracking_code: string;
  book_id: string;
  copy_number: number;
  book_code: string;
  condition: string;
  status: string;
  book_title: string;
  book_author: string;
  isbn?: string;
  total_copies: number;
  available_copies: number;
  // Legacy format for backward compatibility
  books?: {
    id: string;
    title: string;
    author: string;
    book_code: string;
    isbn?: string;
    total_copies: number;
    available_copies: number;
  };
}

interface BookGroup {
  book: {
    id: string;
    title: string;
    author: string;
    book_code: string;
    isbn?: string;
    total_copies: number;
    available_copies: number;
  };
  copies: TrackingCodeSearchResult[];
  total_copies: number;
}

interface ProgressiveSearchResult {
  search_type: 'none' | 'book_code' | 'book_copies' | 'exact';
  data: any;
  search_term: string;
}

// Legacy interface for backward compatibility with existing UI components
interface LegacyProgressiveSearchResult {
  type: 'none' | 'book_code' | 'book_copies' | 'exact';
  data: any;
  searchTerm: string;
}

export const useTrackingCodeSearch = (searchTerm: string) => {
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  return useQuery({
    queryKey: ['tracking-code-progressive-search', debouncedSearchTerm],
    queryFn: async (): Promise<LegacyProgressiveSearchResult> => {
      if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
        return { type: 'none', data: null, searchTerm: debouncedSearchTerm };
      }

      try {
        console.log('Progressive search for:', debouncedSearchTerm);
        
        // Use Tauri command for offline-first search (matches archive manager approach)
        const result = await invoke<ProgressiveSearchResult>('progressive_tracking_code_search', {
          searchTerm: debouncedSearchTerm
        });

        // Transform data to match archive manager's exact format
        let transformedData = result.data;
        
        if (result.search_type === 'exact' && transformedData) {
          // For exact matches, add the books nested structure for backward compatibility
          transformedData = {
            ...transformedData,
            books: {
              id: transformedData.book_id,
              title: transformedData.book_title,
              author: transformedData.book_author,
              book_code: transformedData.book_code,
              isbn: transformedData.isbn,
              total_copies: transformedData.total_copies,
              available_copies: transformedData.available_copies,
            }
          };
        } else if (result.search_type === 'book_code' && transformedData) {
          // For book_code searches, ensure the structure matches archive manager
          const bookGroups: Record<string, any> = {};
          
          Object.entries(transformedData as Record<string, BookGroup>).forEach(([bookId, group]) => {
            bookGroups[bookId] = {
              book: group.book,
              copies: group.copies.map(copy => ({
                ...copy,
                books: {
                  id: copy.book_id,
                  title: copy.book_title,
                  author: copy.book_author,
                  book_code: copy.book_code,
                  isbn: copy.isbn,
                  total_copies: copy.total_copies,
                  available_copies: copy.available_copies,
                }
              })),
              totalCopies: group.total_copies
            };
          });
          
          transformedData = bookGroups;
        } else if (result.search_type === 'book_copies' && transformedData) {
          // For book_copies searches, add books nested structure to each copy
          transformedData = (transformedData as TrackingCodeSearchResult[]).map(copy => ({
            ...copy,
            books: {
              id: copy.book_id,
              title: copy.book_title,
              author: copy.book_author,
              book_code: copy.book_code,
              isbn: copy.isbn,
              total_copies: copy.total_copies,
              available_copies: copy.available_copies,
            }
          }));
        }

        // Convert to legacy format for backward compatibility
        return {
          type: result.search_type as 'none' | 'book_code' | 'book_copies' | 'exact',
          data: transformedData,
          searchTerm: result.search_term
        };
      } catch (error) {
        console.error('Error in progressive search:', error);
        
        // Fallback: try to use Supabase if available (for online mode)
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          
          const upperSearchTerm = debouncedSearchTerm.toUpperCase();

          // First, try exact match by tracking code (matches archive manager)
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
            console.log('Found exact match by tracking code (Supabase fallback):', exactMatch.tracking_code);
            return { type: 'exact', data: exactMatch, searchTerm: upperSearchTerm };
          }

          // If no exact match by tracking code, try legacy book ID (matches archive manager)
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
              console.log('Found exact match by legacy book ID (Supabase fallback):', legacyMatch.legacy_book_id);
              return { type: 'exact', data: legacyMatch, searchTerm: debouncedSearchTerm };
            }
          }

          // If no exact match, look for partial matches (matches archive manager ILIKE approach)
          const { data: partialMatches, error: searchError } = await supabase
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

          if (searchError) {
            console.error('Error in Supabase fallback search:', searchError);
            throw searchError;
          }

          if (partialMatches && partialMatches.length > 0) {
            // Analyze search pattern (matches archive manager logic exactly)
            const parts = upperSearchTerm.split('/');
            
            if (parts.length === 1) {
              // Just book code (e.g., "KID2") - group by book_id like archive manager
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

              console.log('Book code search (Supabase fallback) - found', Object.keys(bookGroups).length, 'books');
              return { type: 'book_code', data: bookGroups, searchTerm: upperSearchTerm };
              
            } else if (parts.length === 2) {
              // Book code + copy number prefix (e.g., "KID2/004") - return copies directly
              console.log('Book copies search (Supabase fallback) - found', partialMatches.length, 'copies');
              return { type: 'book_copies', data: partialMatches, searchTerm: upperSearchTerm };
            }
          }

          console.log('No matches found (Supabase fallback)');
          return { type: 'none', data: null, searchTerm: upperSearchTerm };
          
        } catch (supabaseError) {
          console.error('Supabase fallback also failed:', supabaseError);
          return { type: 'none', data: null, searchTerm: debouncedSearchTerm };
        }
      }
    },
    enabled: !!debouncedSearchTerm && debouncedSearchTerm.length >= 2,
    staleTime: 30000, // Cache for 30 seconds
    retry: 1, // Only retry once
  });
};
