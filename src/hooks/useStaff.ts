import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from './useSystemLogs';

export interface Staff {
  id: string;
  staff_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CreateStaffData {
  staff_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  status?: 'active' | 'inactive';
}

export interface UpdateStaffData extends Partial<CreateStaffData> {
  id: string;
}

export const useStaff = () => {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('first_name');

      if (error) {
        console.error('Error fetching staff:', error);
        throw error;
      }

      return data as Staff[];
    },
  });
};

export const useCreateStaff = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (staffData: CreateStaffData) => {
      const { data, error } = await supabase
        .from('staff')
        .insert(staffData)
        .select()
        .single();

      if (error) {
        console.error('Error creating staff:', error);
        throw error;
      }

      // Log the activity
      await logActivity(
        'staff_created',
        'staff',
        data.id,
        {
          staff_id: staffData.staff_id,
          name: `${staffData.first_name} ${staffData.last_name}`,
          department: staffData.department,
          position: staffData.position
        }
      );

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({
        title: 'Success',
        description: 'Staff member created successfully',
      });
    },
    onError: (error: any) => {
      console.error('Error creating staff:', error);
      toast({
        title: 'Error',
        description: `Failed to create staff member: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateStaff = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...staffData }: UpdateStaffData) => {
      const { data, error } = await supabase
        .from('staff')
        .update(staffData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating staff:', error);
        throw error;
      }

      // Log the activity
      await logActivity(
        'staff_updated',
        'staff',
        id,
        {
          staff_id: data.staff_id,
          name: `${data.first_name} ${data.last_name}`,
          changes: staffData
        }
      );

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({
        title: 'Success',
        description: 'Staff member updated successfully',
      });
    },
    onError: (error: any) => {
      console.error('Error updating staff:', error);
      toast({
        title: 'Error',
        description: `Failed to update staff member: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteStaff = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (staffId: string) => {
      // Get staff details before deletion for logging
      const { data: staffData } = await supabase
        .from('staff')
        .select('*')
        .eq('id', staffId)
        .single();

      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', staffId);

      if (error) {
        console.error('Error deleting staff:', error);
        throw error;
      }

      // Log the activity
      if (staffData) {
        await logActivity(
          'staff_deleted',
          'staff',
          staffId,
          {
            staff_id: staffData.staff_id,
            name: `${staffData.first_name} ${staffData.last_name}`,
            department: staffData.department,
            position: staffData.position
          }
        );
      }

      return staffId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({
        title: 'Success',
        description: 'Staff member deleted successfully',
      });
    },
    onError: (error: any) => {
      console.error('Error deleting staff:', error);
      toast({
        title: 'Error',
        description: `Failed to delete staff member: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useStaffStats = () => {
  return useQuery({
    queryKey: ['staff-stats'],
    queryFn: async () => {
      const [activeResult, inactiveResult, totalResult] = await Promise.all([
        supabase.from('staff').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('staff').select('*', { count: 'exact', head: true }).eq('status', 'inactive'),
        supabase.from('staff').select('*', { count: 'exact', head: true })
      ]);
      
      return {
        active: activeResult.count || 0,
        inactive: inactiveResult.count || 0,
        total: totalResult.count || 0
      };
    }
  });
};