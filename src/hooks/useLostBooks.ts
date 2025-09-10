
import { useQuery } from '@tanstack/react-query';

export const useLostBooks = () => {
  return useQuery({
    queryKey: ['lost-books'],
    queryFn: async () => {
      console.log('Fetching lost books from local database...');
      
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const response = await invoke('get_lost_books');
        
        console.log('Lost books response:', response);
        
        if (response && response.success) {
          const lostBooks = response.data || [];
          console.log('Lost books fetched:', lostBooks.length, lostBooks);
          return lostBooks;
        } else {
          console.warn('Lost books response not successful:', response);
          return [];
        }
      } catch (error) {
        console.error('Error fetching lost books:', error);
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes cache
  });
};
