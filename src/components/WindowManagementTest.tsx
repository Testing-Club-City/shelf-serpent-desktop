import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWindowManagement } from '@/hooks/useWindowManagement';
import { toast } from 'sonner';

type WindowSizePreset = {
  name: string;
  width: number;
  height: number;
};

const WINDOW_SIZE_PRESETS: WindowSizePreset[] = [
  { name: 'Small (800x600)', width: 800, height: 600 },
  { name: 'Medium (1280x720)', width: 1280, height: 720 },
  { name: 'Large (1920x1080)', width: 1920, height: 1080 },
  { name: 'Ultra Wide (2560x1080)', width: 2560, height: 1080 },
];

export const WindowManagementTest = () => {
  const [customWidth, setCustomWidth] = useState<number>(1280);
  const [customHeight, setCustomHeight] = useState<number>(720);
  const [positionX, setPositionX] = useState<number>(100);
  const [positionY, setPositionY] = useState<number>(100);
  
  const {
    isWindowReady,
    error,
    setWindowSizeToScreenRatio,
    setWindowSize,
    setWindowPosition,
    centerWindow,
    maximizeWindow,
    minimizeWindow,
    toggleFullscreen,
    clearError
  } = useWindowManagement();

  const handleDynamicResize = useCallback(async () => {
    if (!isWindowReady) {
      toast.error('Window not ready');
      return;
    }
    
    try {
      const result = await setWindowSizeToScreenRatio(16, 9, 1920, 1080);
      if (result) {
        toast.success(`Window resized to ${result.width}x${result.height}`);
      } else {
        toast.error('Failed to resize window');
      }
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [isWindowReady, setWindowSizeToScreenRatio]);

  const handlePresetResize = useCallback(async (preset: WindowSizePreset) => {
    if (!isWindowReady) {
      toast.error('Window not ready');
      return;
    }
    
    try {
      const success = await setWindowSize(preset.width, preset.height);
      if (success) {
        toast.success(`Window resized to ${preset.name}`);
      } else {
        toast.error(`Failed to resize window to ${preset.name}`);
      }
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [isWindowReady, setWindowSize]);

  const handleCustomResize = useCallback(async () => {
    if (!isWindowReady) {
      toast.error('Window not ready');
      return;
    }
    
    try {
      const success = await setWindowSize(customWidth, customHeight);
      if (success) {
        toast.success(`Window resized to ${customWidth}x${customHeight}`);
      } else {
        toast.error(`Failed to resize window to ${customWidth}x${customHeight}`);
      }
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [isWindowReady, setWindowSize, customWidth, customHeight]);

  const handleSetPosition = useCallback(async () => {
    if (!isWindowReady) {
      toast.error('Window not ready');
      return;
    }
    
    try {
      const success = await setWindowPosition(positionX, positionY);
      if (success) {
        toast.success(`Window positioned at ${positionX}, ${positionY}`);
      } else {
        toast.error('Failed to position window');
      }
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [isWindowReady, setWindowPosition, positionX, positionY]);

  const handleCenterWindow = useCallback(async () => {
    if (!isWindowReady) {
      toast.error('Window not ready');
      return;
    }
    
    try {
      const success = await centerWindow();
      if (success) {
        toast.success('Window centered');
      } else {
        toast.error('Failed to center window');
      }
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [isWindowReady, centerWindow]);

  const handleMaximize = useCallback(async () => {
    if (!isWindowReady) {
      toast.error('Window not ready');
      return;
    }
    
    try {
      const success = await maximizeWindow();
      if (success) {
        toast.success('Window maximized');
      } else {
        toast.error('Failed to maximize window');
      }
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [isWindowReady, maximizeWindow]);

  const handleMinimize = useCallback(async () => {
    if (!isWindowReady) {
      toast.error('Window not ready');
      return;
    }
    
    try {
      const success = await minimizeWindow();
      if (success) {
        toast.success('Window minimized');
      } else {
        toast.error('Failed to minimize window');
      }
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [isWindowReady, minimizeWindow]);

  const handleToggleFullscreen = useCallback(async () => {
    if (!isWindowReady) {
      toast.error('Window not ready');
      return;
    }
    
    try {
      const success = await toggleFullscreen();
      if (success) {
        toast.success('Fullscreen toggled');
      } else {
        toast.error('Failed to toggle fullscreen');
      }
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [isWindowReady, toggleFullscreen]);

  // Clear error when component mounts
  React.useEffect(() => {
    if (error) {
      clearError();
    }
  }, [error, clearError]);

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Window Management Test</CardTitle>
        <CardDescription>
          Test various window management features
          {error && <span className="text-destructive ml-2">Error: {error}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button 
            onClick={handleDynamicResize}
            disabled={!isWindowReady}
            className="w-full"
          >
            Dynamic Resize (16:9)
          </Button>
          
          <Button 
            onClick={handleCenterWindow}
            disabled={!isWindowReady}
            variant="secondary"
            className="w-full"
          >
            Center Window
          </Button>
          
          <Button 
            onClick={handleMaximize}
            disabled={!isWindowReady}
            variant="outline"
            className="w-full"
          >
            Maximize
          </Button>
          
          <Button 
            onClick={handleMinimize}
            disabled={!isWindowReady}
            variant="outline"
            className="w-full"
          >
            Minimize
          </Button>
          
          <Button 
            onClick={handleToggleFullscreen}
            disabled={!isWindowReady}
            variant="outline"
            className="w-full"
          >
            Toggle Fullscreen
          </Button>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Preset Sizes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {WINDOW_SIZE_PRESETS.map((preset) => (
              <Button
                key={preset.name}
                onClick={() => handlePresetResize(preset)}
                disabled={!isWindowReady}
                variant="secondary"
                className="w-full justify-start"
              >
                {preset.name}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Custom Size</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="width">Width</Label>
              <Input
                id="width"
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(Number(e.target.value))}
                min="100"
                max="4096"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Height</Label>
              <Input
                id="height"
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(Number(e.target.value))}
                min="100"
                max="2160"
              />
            </div>
          </div>
          <Button 
            onClick={handleCustomResize}
            disabled={!isWindowReady}
            className="w-full"
          >
            Set Custom Size
          </Button>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Window Position</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="position-x">X Position</Label>
              <Input
                id="position-x"
                type="number"
                value={positionX}
                onChange={(e) => setPositionX(Number(e.target.value))}
                min="0"
                max="4096"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position-y">Y Position</Label>
              <Input
                id="position-y"
                type="number"
                value={positionY}
                onChange={(e) => setPositionY(Number(e.target.value))}
                min="0"
                max="2160"
              />
            </div>
          </div>
          <Button 
            onClick={handleSetPosition}
            disabled={!isWindowReady}
            variant="secondary"
            className="w-full"
          >
            Set Position
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WindowManagementTest;
