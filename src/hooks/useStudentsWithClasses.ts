import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { offlineDataService } from '@/services/offlineDataService';
import { useConnectivity } from './useConnectivity';

// Use any for flexible data structure
export interface StudentWithClass {
  [key: string]: any;
}

/**
 * Enhanced hook for fetching students with proper class relationships
 * Fixes the data inconsistency issues between local and remote
 */
export const useStudentsWithClasses = (options?: {
  includeClasses?: boolean;
  filters?: {
    classGrade?: string;
    status?: string;
    search?: string;
  };
}) => {
  const connectivity = useConnectivity();
  
  // Only include non-search filters in query key to prevent unnecessary refetches
  const queryKeyFilters = {
    classGrade: options?.filters?.classGrade,
    status: options?.filters?.status,
    includeClasses: options?.includeClasses
  };
  
  return useQuery({
    queryKey: ['students-with-classes', queryKeyFilters],
    queryFn: async (): Promise<StudentWithClass[]> => {
      console.log('Fetching all students with classes from local database...');
      
      try {
        // Always use local SQLite database to avoid Supabase pagination limits
        // We have all students synced locally via comprehensive sync
        const students = await offlineDataService.getStudents();
        const classes = await offlineDataService.getClasses();
        
        // If we have connectivity and want to refresh, we can trigger a background sync
        // but always return the complete local dataset for display
        if (connectivity.isOnline) {
          console.log('Using local SQLite data (all students loaded)');
        } else {
          console.log('Using offline local SQLite data (all students available)');
        }

        // Map students with their classes using local data
        const studentsWithClasses = students.map((student: any) => {
          // Find the class that matches the student's class_grade
          const classData = classes.find((c: any) => 
            c.class_name === student.class_grade
          );

          return {
            ...student,
            class: classData,
            class_name: classData?.class_name || student.class_grade || 'Unknown Class'
          };
        });

        // Apply non-search filters only (search will be handled client-side)
        let filteredStudents = studentsWithClasses;
        
        if (options?.filters?.classGrade) {
          filteredStudents = filteredStudents.filter(s => 
            s.class?.form_level?.toString() === options.filters?.classGrade ||
            s.class_grade === options.filters?.classGrade
          );
        }
        
        if (options?.filters?.status) {
          filteredStudents = filteredStudents.filter(s => s.status === options.filters?.status);
        }

        console.log(`Found ${filteredStudents.length} students with classes (before search filter)`);
        return filteredStudents;
        
      } catch (error) {
        console.error('Error in useStudentsWithClasses:', error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Retry more aggressively when offline
      if (!connectivity.isOnline && failureCount < 3) {
        return true;
      }
      return failureCount < 2;
    },
  });
};

/**
 * Helper hook that applies search filter client-side to prevent refetching
 */
export const useFilteredStudentsWithClasses = (options?: {
  includeClasses?: boolean;
  filters?: {
    classGrade?: string;
    status?: string;
    search?: string;
  };
}) => {
  const baseQuery = useStudentsWithClasses({
    includeClasses: options?.includeClasses,
    filters: {
      classGrade: options?.filters?.classGrade,
      status: options?.filters?.status
      // Exclude search from base query
    }
  });

  // Apply search filter client-side using useMemo
  const filteredData = useMemo(() => {
    if (!baseQuery.data || !options?.filters?.search) {
      return baseQuery.data;
    }

    const search = options.filters.search.toLowerCase();
    return baseQuery.data.filter(s => 
      s.first_name?.toLowerCase().includes(search) ||
      s.last_name?.toLowerCase().includes(search) ||
      s.admission_number?.toLowerCase().includes(search) ||
      s.class_name?.toLowerCase().includes(search)
    );
  }, [baseQuery.data, options?.filters?.search]);

  return {
    ...baseQuery,
    data: filteredData
  };
};

/**
 * Hook for fetching classes with student counts
 */
export const useClassesWithStudents = () => {
  const connectivity = useConnectivity();
  
  return useQuery({
    queryKey: ['classes-with-students'],
    queryFn: async () => {
      console.log('Fetching all classes with student counts from local database...');
      
      try {
        // Always use local SQLite database to avoid Supabase pagination limits
        // We have all classes and students synced locally via comprehensive sync
        const [classes, students] = await Promise.all([
          offlineDataService.getClasses(),
          offlineDataService.getStudents()
        ]);

        // Map classes with student counts
        const classesWithCounts = classes.map((cls: any) => ({
          ...cls,
          studentCount: students.filter((s: any) => 
            s.class_grade === cls.class_name ||
            s.class_grade === `${cls.form_level}${cls.class_section}`
          ).length
        }));

        return classesWithCounts.sort((a, b) => {
          if (a.form_level !== b.form_level) {
            return a.form_level - b.form_level;
          }
          // Handle null/undefined class_section values
          const sectionA = a.class_section || '';
          const sectionB = b.class_section || '';
          return sectionA.localeCompare(sectionB);
        });
        
      } catch (error) {
        console.error('Error in useClassesWithStudents:', error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
