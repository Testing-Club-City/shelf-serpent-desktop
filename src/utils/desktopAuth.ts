/**
 * Desktop Browser Authentication Utilities
 * Handles browser-specific authentication issues on desktop environments
 */

export const isDesktopBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  return !isMobile;
};

export const clearDesktopAuthCache = (): void => {
  if (!isDesktopBrowser()) return;
  
  try {
    // Clear localStorage auth tokens
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes('supabase') || key.includes('auth')) {
        localStorage.removeItem(key);
      }
    });

    // Clear sessionStorage auth tokens
    const sessionKeys = Object.keys(sessionStorage);
    sessionKeys.forEach(key => {
      if (key.includes('supabase') || key.includes('auth')) {
        sessionStorage.removeItem(key);
      }
    });

    console.log('Desktop auth cache cleared');
  } catch (error) {
    console.warn('Failed to clear desktop auth cache:', error);
  }
};

export const forceDesktopSessionRefresh = async (): Promise<void> => {
  if (!isDesktopBrowser()) return;
  
  try {
    // Clear cache first
    clearDesktopAuthCache();
    
    // Force a page reload to ensure clean state
    setTimeout(() => {
      if (window.location.pathname !== '/login') {
        window.location.reload();
      }
    }, 100);
    
  } catch (error) {
    console.warn('Failed to force desktop session refresh:', error);
  }
};

export const getDesktopAuthTimeout = (): number => {
  return isDesktopBrowser() ? 3000 : 5000;
};
