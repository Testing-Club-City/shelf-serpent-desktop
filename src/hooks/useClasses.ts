import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useClasses = () => {
  return useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('is_active', true)
        .order('form_level', { ascending: true })
        .order('class_section', { ascending: true });

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Refetch when component mounts
  });
};

export const useCreateClass = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (classData: any) => {
      const { data, error } = await supabase
        .from('classes')
        .insert(classData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({
        title: 'Success',
        description: 'Class created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create class: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateClass = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase
        .from('classes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({
        title: 'Success',
        description: 'Class updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update class: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteClass = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({
        title: 'Success',
        description: 'Class deleted successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete class: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};
