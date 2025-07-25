import { useSystemSettings } from './useSystemSettings';
import { useMemo } from 'react';

export const useBorrowingSettings = () => {
  const { data: settings } = useSystemSettings();

  // Memoize the borrowing period to prevent unnecessary recalculations
  const borrowingPeriodDays = useMemo(() => {
    const setting = settings?.find(s => s.setting_key === 'max_borrow_period');
    const days = setting ? parseInt(setting.setting_value) : 14;
    return isNaN(days) ? 14 : days;
  }, [settings]);

  // Memoize max books per student
  const maxBooksPerStudent = useMemo(() => {
    const setting = settings?.find(s => s.setting_key === 'max_books_per_student');
    const books = setting ? parseInt(setting.setting_value) : 2;
    return isNaN(books) ? 2 : books;
  }, [settings]);

  // Memoize the calculateDueDate function
  const calculateDueDate = useMemo(() => {
    return (borrowDate: Date = new Date()): string => {
      const dueDate = new Date(borrowDate);
      dueDate.setDate(dueDate.getDate() + borrowingPeriodDays);
      return dueDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    };
  }, [borrowingPeriodDays]);

  // Memoize the getBorrowingPeriodDays function
  const getBorrowingPeriodDays = useMemo(() => {
    return (): number => borrowingPeriodDays;
  }, [borrowingPeriodDays]);

  // Memoize the getMaxBooksPerStudent function
  const getMaxBooksPerStudent = useMemo(() => {
    return (): number => maxBooksPerStudent;
  }, [maxBooksPerStudent]);

  return {
    getBorrowingPeriodDays,
    getMaxBooksPerStudent,
    calculateDueDate,
    // Also expose the raw values for components that need them
    borrowingPeriodDays,
    maxBooksPerStudent,
  };
};