/**
 * Safe date utilities to handle invalid system time and date parsing errors
 */

/**
 * Safely create a current date, with fallback for invalid system time
 */
export const getSafeCurrentDate = (): Date => {
  try {
    const now = new Date();
    if (isNaN(now.getTime())) {
      // Fallback to a valid date if system time is wrong
      console.warn('System date is invalid, using fallback date');
      return new Date('2024-01-01T00:00:00.000Z');
    }
    return now;
  } catch (error) {
    console.error('Error creating current date:', error);
    return new Date('2024-01-01T00:00:00.000Z');
  }
};

/**
 * Safely create a Date object from a string, with fallback for invalid dates
 */
export const getSafeDate = (dateString: string | Date): Date => {
  try {
    if (dateString instanceof Date) {
      if (isNaN(dateString.getTime())) {
        console.warn('Invalid Date object provided');
        return getSafeCurrentDate();
      }
      return dateString;
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString);
      return getSafeCurrentDate();
    }
    return date;
  } catch (error) {
    console.error('Error creating date from string:', dateString, error);
    return getSafeCurrentDate();
  }
};

/**
 * Safely create an ISO string from a date, with fallback
 */
export const getSafeISOString = (date?: Date): string => {
  try {
    const targetDate = date || getSafeCurrentDate();
    if (isNaN(targetDate.getTime())) {
      return new Date('2024-01-01T00:00:00.000Z').toISOString();
    }
    return targetDate.toISOString();
  } catch (error) {
    console.error('Error creating ISO string:', error);
    return new Date('2024-01-01T00:00:00.000Z').toISOString();
  }
};

/**
 * Safely format a date string for display
 */
export const safeFormatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  
  try {
    const date = getSafeDate(dateString);
    return date.toLocaleDateString();
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Safely calculate difference between two dates in days
 */
export const safeDateDiffInDays = (date1: string | Date, date2: string | Date): number => {
  try {
    const d1 = getSafeDate(date1);
    const d2 = getSafeDate(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch (error) {
    console.error('Error calculating date difference:', error);
    return 0;
  }
};

/**
 * Check if the system time appears to be valid
 */
export const isSystemTimeValid = (): boolean => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    // Consider dates between 2020 and 2030 as reasonable
    return year >= 2020 && year <= 2030 && !isNaN(now.getTime());
  } catch (error) {
    return false;
  }
};

/**
 * Get a warning message for invalid system time
 */
export const getSystemTimeWarning = (): string | null => {
  if (!isSystemTimeValid()) {
    return 'Warning: System date appears to be incorrect. This may cause issues with date calculations. Please check your system time settings.';
  }
  return null;
};
