import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook to debounce a value
 * @param value - The value to debounce
 * @param delay - The debounce delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook to debounce a function
 * @param func - The function to debounce
 * @param delay - The debounce delay in milliseconds
 * @returns The debounced function
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedFunc = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        func(...args);
      }, delay);
    },
    [func, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFunc as T;
}
