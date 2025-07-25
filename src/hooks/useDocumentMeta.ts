import { useEffect } from 'react';

type PageState = 'idle' | 'loading' | 'submitting' | 'error' | 'success';

interface UseDocumentMetaProps {
  baseTitle?: string;
  schoolName?: string;
  state?: PageState;
  customTitle?: string;
}

/**
 * Hook to manage document title and favicon based on application state
 * 
 * @param baseTitle - Base title of the application
 * @param schoolName - Name of the school to include in the title
 * @param state - Current page state (idle, loading, submitting, error, success)
 * @param customTitle - Custom title to use (overrides other title settings)
 */
export function useDocumentMeta({
  baseTitle = 'Library System',
  schoolName,
  state = 'idle',
  customTitle,
}: UseDocumentMetaProps = {}) {
  useEffect(() => {
    // Build the title based on the state
    let title = customTitle;
    
    if (!title) {
      const schoolPrefix = schoolName ? `${schoolName} - ` : '';
      
      switch (state) {
        case 'loading':
          title = `${schoolPrefix}Loading... | ${baseTitle}`;
          break;
        case 'submitting':
          title = `${schoolPrefix}Submitting... | ${baseTitle}`;
          break;
        case 'error':
          title = `${schoolPrefix}Error | ${baseTitle}`;
          break;
        case 'success':
          title = `${schoolPrefix}Success | ${baseTitle}`;
          break;
        case 'idle':
        default:
          title = `${schoolPrefix}${baseTitle}`;
          break;
      }
    }
    
    // Update the document title
    document.title = title;
    
    // Update favicon based on state
    const faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (faviconLink) {
      switch (state) {
        case 'loading':
          faviconLink.href = '/favicon-loading.svg';
          break;
        case 'submitting':
          faviconLink.href = '/favicon-submitting.svg';
          break;
        case 'error':
          faviconLink.href = '/favicon-error.svg';
          break;
        case 'success':
          faviconLink.href = '/favicon-success.svg';
          break;
        case 'idle':
        default:
          faviconLink.href = '/favicon.svg';
          break;
      }
    }
    
    // Clean up function to reset title and favicon when component unmounts
    return () => {
      if (!customTitle) {
        const defaultTitle = schoolName ? `${schoolName} - ${baseTitle}` : baseTitle;
        document.title = defaultTitle;
      }
      
      if (faviconLink) {
        faviconLink.href = '/favicon.svg';
      }
    };
  }, [baseTitle, schoolName, state, customTitle]);
  
  // Function to manually update the title and state
  const updateMeta = (newState: PageState, newCustomTitle?: string) => {
    const schoolPrefix = schoolName ? `${schoolName} - ` : '';
    let title = newCustomTitle;
    
    if (!title) {
      switch (newState) {
        case 'loading':
          title = `${schoolPrefix}Loading... | ${baseTitle}`;
          break;
        case 'submitting':
          title = `${schoolPrefix}Submitting... | ${baseTitle}`;
          break;
        case 'error':
          title = `${schoolPrefix}Error | ${baseTitle}`;
          break;
        case 'success':
          title = `${schoolPrefix}Success | ${baseTitle}`;
          break;
        case 'idle':
        default:
          title = `${schoolPrefix}${baseTitle}`;
          break;
      }
    }
    
    document.title = title;
    
    // Update favicon based on state
    const faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (faviconLink) {
      switch (newState) {
        case 'loading':
          faviconLink.href = '/favicon-loading.svg';
          break;
        case 'submitting':
          faviconLink.href = '/favicon-submitting.svg';
          break;
        case 'error':
          faviconLink.href = '/favicon-error.svg';
          break;
        case 'success':
          faviconLink.href = '/favicon-success.svg';
          break;
        case 'idle':
        default:
          faviconLink.href = '/favicon.svg';
          break;
      }
    }
  };
  
  return { updateMeta };
} 