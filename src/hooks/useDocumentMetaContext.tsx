import React, { createContext, useContext, useState, useCallback } from 'react';
import { useDocumentMeta } from './useDocumentMeta';

type PageState = 'idle' | 'loading' | 'submitting' | 'error' | 'success';

interface DocumentMetaContextType {
  updatePageState: (state: PageState, customTitle?: string) => void;
  currentState: PageState;
}

const DocumentMetaContext = createContext<DocumentMetaContextType | undefined>(undefined);

interface DocumentMetaProviderProps {
  children: React.ReactNode;
  baseTitle?: string;
  schoolName?: string;
}

export const DocumentMetaProvider: React.FC<DocumentMetaProviderProps> = ({
  children,
  baseTitle = 'Library Management System',
  schoolName,
}) => {
  const [currentState, setCurrentState] = useState<PageState>('idle');
  const [customTitle, setCustomTitle] = useState<string | undefined>(undefined);
  
  // Use the document meta hook
  const { updateMeta } = useDocumentMeta({
    baseTitle,
    schoolName,
    state: currentState,
    customTitle,
  });
  
  // Function to update page state and title
  const updatePageState = useCallback((state: PageState, newCustomTitle?: string) => {
    setCurrentState(state);
    setCustomTitle(newCustomTitle);
    updateMeta(state, newCustomTitle);
  }, [updateMeta]);
  
  return (
    <DocumentMetaContext.Provider value={{ updatePageState, currentState }}>
      {children}
    </DocumentMetaContext.Provider>
  );
};

// Hook to use the document meta context
export const useDocumentMetaContext = () => {
  const context = useContext(DocumentMetaContext);
  
  if (context === undefined) {
    throw new Error('useDocumentMetaContext must be used within a DocumentMetaProvider');
  }
  
  return context;
}; 