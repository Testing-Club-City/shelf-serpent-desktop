import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { offlineDataService } from '@/services/offlineDataService';
import { useToast } from '@/hooks/use-toast';
import { useConnectivity } from '@/hooks/useConnectivity';
import { supabase } from '@/integrations/supabase/client';

interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created_at?: string;
  updated_at?: string;
}

// Categories data service
class CategoriesDataService {
  private isOnline: boolean = false;

  constructor(private connectivity: ReturnType<typeof useConnectivity>) {
    this.isOnline = connectivity.isOnline;
  }

  async getCategories(): Promise<Category[]> {
    try {
      const offlineCategories = await offlineDataService.getCategories();
      console.log(`Loaded ${offlineCategories.length} categories from offline database`);
      
      if (this.isOnline) {
        this.syncCategoriesInBackground().catch(console.error);
      }
      
      return offlineCategories;
    } catch (error) {
      console.error('Failed to load from offline DB, falling back to Supabase:', error);
      
      if (this.isOnline) {
        return this.getCategoriesFromSupabase();
      }
      
      throw new Error('No offline data available and no internet connection');
    }
  }

  private async getCategoriesFromSupabase(): Promise<Category[]> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch categories from Supabase:', error);
      throw error;
    }
  }

  private async syncCategoriesInBackground() {
    try {
      const supabaseCategories = await this.getCategoriesFromSupabase();
      console.log(`Syncing ${supabaseCategories.length} categories from Supabase`);
      
      // Store in offline database
      for (const category of supabaseCategories) {
        try {
          await offlineDataService.createCategory(category);
        } catch (error) {
          console.error(`Failed to sync category ${category.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }

  async createCategory(categoryData: any): Promise<string> {
    try {
      const categoryId = await offlineDataService.createCategory(categoryData);
      console.log('Category created in offline database:', categoryId);

      if (this.isOnline) {
        try {
          const { data, error } = await supabase
            .from('categories')
            .insert(categoryData)
            .select()
            .single();

          if (error) throw error;
          console.log('Category synced to Supabase');
          return data.id || categoryId;
        } catch (syncError) {
          console.error('Failed to sync category to Supabase:', syncError);
        }
      }

      return categoryId;
    } catch (error) {
      console.error('Failed to create category:', error);
      throw error;
    }
  }
}

// React hooks
export const useCategoriesOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['categories', 'offline-first'],
    queryFn: async () => {
      const service = new CategoriesDataService(connectivity);
      return await service.getCategories();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      if (!connectivity.isOnline && failureCount < 2) {
        return true;
      }
      return failureCount < 1;
    },
  });
};

export const useCreateCategoryOffline = () => {
  const { toast } = useToast();
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryData: any) => {
      const service = new CategoriesDataService(connectivity);
      return await service.createCategory(categoryData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', 'offline-first'] });
      toast({
        title: "Category created",
        description: "Category saved to offline database and will sync when online",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create category",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
};
