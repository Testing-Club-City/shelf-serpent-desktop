import { useQuery } from '@tanstack/react-query';

export const useTheftReports = () => {
  return useQuery({
    queryKey: ['theft-reports'],
    queryFn: async () => {
      console.log('Fetching theft reports from local database...');
      
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const response = await invoke('get_theft_reports');
        
        console.log('Theft reports response:', response);
        
        if (response && response.success) {
          const theftReports = response.data || [];
          console.log('Theft reports fetched:', theftReports.length, theftReports);
          return theftReports;
        } else {
          console.warn('Theft reports response not successful:', response);
          return [];
        }
      } catch (error) {
        console.error('Error fetching theft reports:', error);
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes cache
  });
};