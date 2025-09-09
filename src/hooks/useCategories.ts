import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/hooks/use-toast';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type Category = Tables<'categories'>;
type CategoryInsert = TablesInsert<'categories'>;
type CategoryUpdate = TablesUpdate<'categories'>;

export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      try {
        const categories = await invoke<Category[]>('get_categories');
        return categories || [];
      } catch (error) {
        console.error('Error fetching categories from local database:', error);
        throw error;
      }
    },
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (category: CategoryInsert) => {
      try {
        const categoryId = await invoke<string>('create_category', { categoryData: category });
        return { ...category, id: categoryId };
      } catch (error) {
        console.error('Error creating category:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({
        title: 'Success',
        description: 'Category created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to create category: ${error}`,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: CategoryUpdate & { id: string }) => {
      try {
        await invoke('update_category', { categoryId: id, categoryData: updates });
        return { id, ...updates };
      } catch (error) {
        console.error('Error updating category:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({
        title: 'Success',
        description: 'Category updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to update category: ${error}`,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await invoke('delete_category', { categoryId: id });
      } catch (error) {
        console.error('Error deleting category:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({
        title: 'Success',
        description: 'Category deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to delete category: ${error}`,
        variant: 'destructive',
      });
    },
  });
};
