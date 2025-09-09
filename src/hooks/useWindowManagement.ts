import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useCallback, useEffect, useState } from 'react';

interface WindowSizeInfo {
  width: number;
  height: number;
  screenWidth: number;
  screenHeight: number;
}

interface WindowPosition {
  x: number;
  y: number;
}

export const useWindowManagement = () => {
  const [window, setWindow] = useState<WebviewWindow | null>(null);
  const [isWindowReady, setIsWindowReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the main window instance
  useEffect(() => {
    const initializeWindow = async () => {
      try {
        const mainWindow = (await WebviewWindow.getByLabel('main')) || null;
        setWindow(mainWindow);
        setIsWindowReady(!!mainWindow);
      } catch (err) {
        console.error('Failed to get main window:', err);
        setError('Failed to initialize window management');
      }
    };

    initializeWindow();
  }, []);

  // Set window size based on screen ratio
  const setWindowSizeToScreenRatio = useCallback(async (
    widthRatio: number = 16,
    heightRatio: number = 9,
    maxWidth?: number,
    maxHeight?: number
  ): Promise<WindowSizeInfo | null> => {
    if (!isWindowReady || !window) {
      setError('Window not ready');
      return null;
    }

    try {
      const sizeInfo = await invoke<WindowSizeInfo>('set_window_size_to_screen_ratio', {
        window,
        widthRatio,
        heightRatio,
        maxWidth,
        maxHeight
      });
      return sizeInfo;
    } catch (err) {
      console.error('Failed to set window size to screen ratio:', err);
      setError(err instanceof Error ? err.message : 'Failed to set window size');
      return null;
    }
  }, [isWindowReady, window]);

  // Set window size to specific dimensions
  const setWindowSize = useCallback(async (
    width: number,
    height: number
  ): Promise<boolean> => {
    if (!isWindowReady || !window) {
      setError('Window not ready');
      return false;
    }

    try {
      await invoke('set_window_size', { window, width, height });
      return true;
    } catch (err) {
      console.error('Failed to set window size:', err);
      setError(err instanceof Error ? err.message : 'Failed to set window size');
      return false;
    }
  }, [isWindowReady, window]);

  // Set window position
  const setWindowPosition = useCallback(async (
    x: number,
    y: number
  ): Promise<boolean> => {
    if (!isWindowReady || !window) {
      setError('Window not ready');
      return false;
    }

    try {
      await invoke('set_window_position', { window, x, y });
      return true;
    } catch (err) {
      console.error('Failed to set window position:', err);
      setError(err instanceof Error ? err.message : 'Failed to set window position');
      return false;
    }
  }, [isWindowReady, window]);

  // Center window on screen
  const centerWindow = useCallback(async (): Promise<boolean> => {
    if (!isWindowReady || !window) {
      setError('Window not ready');
      return false;
    }

    try {
      await invoke('center_window', { window });
      return true;
    } catch (err) {
      console.error('Failed to center window:', err);
      setError(err instanceof Error ? err.message : 'Failed to center window');
      return false;
    }
  }, [isWindowReady, window]);

  // Maximize window
  const maximizeWindow = useCallback(async (): Promise<boolean> => {
    if (!isWindowReady || !window) {
      setError('Window not ready');
      return false;
    }

    try {
      await invoke('maximize_window', { window });
      return true;
    } catch (err) {
      console.error('Failed to maximize window:', err);
      setError(err instanceof Error ? err.message : 'Failed to maximize window');
      return false;
    }
  }, [isWindowReady, window]);

  // Minimize window
  const minimizeWindow = useCallback(async (): Promise<boolean> => {
    if (!isWindowReady || !window) {
      setError('Window not ready');
      return false;
    }

    try {
      await invoke('minimize_window', { window });
      return true;
    } catch (err) {
      console.error('Failed to minimize window:', err);
      setError(err instanceof Error ? err.message : 'Failed to minimize window');
      return false;
    }
  }, [isWindowReady, window]);

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(async (): Promise<boolean> => {
    if (!isWindowReady || !window) {
      setError('Window not ready');
      return false;
    }

    try {
      await invoke('toggle_fullscreen', { window });
      return true;
    } catch (err) {
      console.error('Failed to toggle fullscreen:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle fullscreen');
      return false;
    }
  }, [isWindowReady, window]);

  // Close window
  const closeWindow = useCallback(async (): Promise<boolean> => {
    if (!isWindowReady || !window) {
      setError('Window not ready');
      return false;
    }

    try {
      await invoke('close_window', { window });
      return true;
    } catch (err) {
      console.error('Failed to close window:', err);
      setError(err instanceof Error ? err.message : 'Failed to close window');
      return false;
    }
  }, [isWindowReady, window]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    window,
    isWindowReady,
    error,
    
    // Window sizing
    setWindowSizeToScreenRatio,
    setWindowSize,
    
    // Window positioning
    setWindowPosition,
    centerWindow,
    
    // Window state
    maximizeWindow,
    minimizeWindow,
    toggleFullscreen,
    closeWindow,
    
    // Utilities
    clearError
  };
};
