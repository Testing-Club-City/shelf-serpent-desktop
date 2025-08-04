import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOfflineAuth } from '@/hooks/useOfflineAuth';

export const useProfile = () => {
  const { user } = useOfflineAuth();
  
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            console.log('No profile found, creating one...');
          } else {
            console.error('Error fetching profile:', error);
          }
          
          if (user) {
            try {
              const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                  id: user.id,
                  email: user.email || '',
                  first_name: user.user_metadata?.first_name || '',
                  last_name: user.user_metadata?.last_name || '',
                  role: user.user_metadata?.role || user.email === 'admin@library.com' ? 'admin' : 'librarian',
                })
                .select()
                .single();
                
              if (createError) {
                console.error('Error creating profile:', createError);
                return null;
              }
              
              return newProfile;
            } catch (createErr) {
              console.error('Exception creating profile:', createErr);
              return null;
            }
          }
          
          return null;
        }
        
        return data;
      } catch (err) {
        console.error('Exception in profile query:', err);
        return null;
      }
    },
    enabled: !!user?.id,
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useOfflineAuth();

  return useMutation({
    mutationFn: async (updates: any) => {
      if (!user?.id) throw new Error('No user found');
      
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update profile: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useAllProfiles = () => {
  return useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useCreateLibrarian = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ email, password, profile }: { 
      email: string; 
      password: string; 
      profile: any 
    }) => {
      try {
        const { data: existingUsers, error: checkError } = await supabase
          .from('profiles')
          .select('email')
          .eq('email', email)
          .limit(1);
          
        if (checkError) throw checkError;
        if (existingUsers && existingUsers.length > 0) {
          throw new Error('A user with this email already exists');
        }
        
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: profile.first_name,
              last_name: profile.last_name,
              role: 'librarian'
            }
          }
        });

        if (authError) throw authError;
        if (!authData.user?.id) throw new Error('Failed to create user account');

        const { data: profileData, error: profileError } = await supabase.rpc(
          'create_librarian_profile',
          {
            user_id: authData.user.id,
            user_email: email,
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone_number: profile.phone || null,
          }
        );

        if (profileError) {
          console.error('Failed to create profile:', profileError);
          throw new Error(`Failed to create profile: ${profileError.message}`);
        }
        
        return {
          id: authData.user.id,
          email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          role: 'librarian',
        };
      } catch (error) {
        console.error('Error creating librarian:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-profiles'] });
      toast({
        title: 'Success',
        description: 'Librarian account created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create librarian: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateLibrarian = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-profiles'] });
      toast({
        title: 'Success',
        description: 'Librarian updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update librarian: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteLibrarian = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-profiles'] });
      toast({
        title: 'Success',
        description: 'Librarian deleted successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete librarian: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useSuspendLibrarian = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, suspended }: { id: string; suspended: boolean }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          suspended,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['all-profiles'] });
      toast({
        title: 'Success',
        description: `Librarian ${variables.suspended ? 'suspended' : 'activated'} successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update librarian status: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useCreateAdmin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ email, password, profile }: { 
      email: string; 
      password: string; 
      profile: any 
    }) => {
      try {
        const { data: existingUsers, error: checkError } = await supabase
          .from('profiles')
          .select('email')
          .eq('email', email)
          .limit(1);
          
        if (checkError) throw checkError;
        if (existingUsers && existingUsers.length > 0) {
          throw new Error('A user with this email already exists');
        }
        
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: profile.first_name,
              last_name: profile.last_name,
              role: 'admin'
            }
          }
        });

        if (authError) throw authError;
        if (!authData.user?.id) throw new Error('Failed to create user account');

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email,
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: profile.phone || null,
            role: 'admin',
          })
          .select()
          .single();

        if (profileError) {
          console.error('Failed to create profile:', profileError);
          throw new Error(`Failed to create profile: ${profileError.message}`);
        }
        
        return profileData;
      } catch (error) {
        console.error('Error creating admin:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-profiles'] });
      toast({
        title: 'Success',
        description: 'Admin account created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create admin: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};
