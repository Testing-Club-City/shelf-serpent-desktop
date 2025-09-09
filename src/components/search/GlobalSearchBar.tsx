import React from 'react';
import { SafeGlobalSearchBar } from './SafeGlobalSearchBar';

interface GlobalSearchBarProps {
  value?: string;
  onResultSelect?: (result: any) => void;
  onSearchTermChange?: (term: string) => void;
  onStudentSelect?: (student: any) => void;
  onBookSelect?: (book: any) => void;
  onBorrowingSelect?: (borrowing: any) => void;
  placeholder?: string;
  className?: string;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = (props) => {
  return <SafeGlobalSearchBar {...props} />;
};
