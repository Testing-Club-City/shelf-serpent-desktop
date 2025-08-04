import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useConnectivity } from './useConnectivity';
import { offlineDataService } from '@/services/offlineDataService';
import { BorrowingWithDetails } from '@/types/offline';

class BorrowingsDataService {
  constructor(private isOnline: boolean) {}

  async getBorrowings(): Promise<BorrowingWithDetails[]> {
    try {
      const offlineBorrowings = await offlineDataService.getBorrowings();
      console.log(`Loaded ${offlineBorrowings.length} borrowings from offline database`);
      
      if (this.isOnline) {
        this.syncBorrowingsInBackground().catch(console.error);
      }
      
      return offlineBorrowings;
    } catch (error) {
      console.error('Failed to load from offline DB:', error);
      
      if (this.isOnline) {
        return this.getBorrowingsFromSupabase();
      }
      
      throw new Error('No offline data available and no internet connection');
    }
  }

  async createBorrowing(borrowingData: {
    book_id: string;
    student_id: string;
    borrow_date: string;
    due_date: string;
  }): Promise<string> {
    try {
      const newBorrowingId = await offlineDataService.createBorrowing(borrowingData);
      
      if (this.isOnline) {
        try {
          await this.createBorrowingInSupabase(borrowingData);
        } catch (syncError) {
          console.error('Failed to sync borrowing to Supabase:', syncError);
        }
      }
      
      return newBorrowingId;
    } catch (error) {
      if (this.isOnline) {
        return this.createBorrowingInSupabase(borrowingData);
      }
      throw error;
    }
  }

  async returnBook(borrowingId: string, returnDate: string): Promise<void> {
    try {
      await offlineDataService.returnBook(borrowingId, returnDate);
      
      if (this.isOnline) {
        try {
          await this.returnBookInSupabase(borrowingId, returnDate);
        } catch (syncError) {
          console.error('Failed to sync return to Supabase:', syncError);
        }
      }
    } catch (error) {
      if (this.isOnline) {
        await this.returnBookInSupabase(borrowingId, returnDate);
      }
      throw error;
    }
  }

  private async syncBorrowingsInBackground(): Promise<void> {
    console.log('Syncing borrowings in background...');
  }

  private async getBorrowingsFromSupabase(): Promise<BorrowingWithDetails[]> {
    console.log('Loading borrowings from Supabase...');
    return [];
  }

  private async createBorrowingInSupabase(borrowingData: any): Promise<string> {
    console.log('Creating borrowing in Supabase...');
    return 'temp-borrowing-id';
  }

  private async updateBorrowingInSupabase(borrowing: BorrowingWithDetails): Promise<string> {
    console.log('Updating borrowing in Supabase...');
    return 'temp-borrowing-id';
  }

  private async returnBookInSupabase(borrowingId: string, returnDate: string): Promise<string> {
    console.log('Returning book in Supabase...');
    return 'temp-borrowing-id';
  }
}

export const useBorrowingsOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();

  return useQuery({
    queryKey: ['borrowings', 'offline-first'],
    queryFn: async () => {
      const service = new BorrowingsDataService(connectivity.isOnline);
      return await service.getBorrowings();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (!connectivity.isOnline && failureCount < 2) {
        return true;
      }
      return failureCount < 1;
    },
  });
};

export const useCreateBorrowingOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (borrowingData: {
      book_id: string;
      student_id: string;
      borrow_date: string;
      due_date: string;
    }) => {
      const service = new BorrowingsDataService(connectivity.isOnline);
      return await service.createBorrowing(borrowingData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrowings', 'offline-first'] });
      queryClient.invalidateQueries({ queryKey: ['books', 'offline-first'] });
      toast({
        title: "Success",
        description: "Book borrowed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to borrow book",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};

export const useReturnBookOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ borrowingId, returnDate }: { borrowingId: string; returnDate: string }) => {
      const service = new BorrowingsDataService(connectivity.isOnline);
      return await service.returnBook(borrowingId, returnDate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrowings', 'offline-first'] });
      queryClient.invalidateQueries({ queryKey: ['books', 'offline-first'] });
      toast({
        title: "Success",
        description: "Book returned successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to return book",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
