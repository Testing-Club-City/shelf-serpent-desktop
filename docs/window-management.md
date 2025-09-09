# Window Management Features

## Overview

This document describes the window management features implemented in Shelf Serpent Desktop, which provide dynamic window sizing and comprehensive window control capabilities.

## Features

### Dynamic Window Sizing

The application automatically adjusts its window size based on the screen resolution while maintaining a 16:9 aspect ratio. This ensures optimal viewing experience across different devices and screen sizes.

- **Aspect Ratio**: Maintains 16:9 aspect ratio for optimal viewing
- **Resolution Detection**: Automatically detects screen resolution
- **Responsive Design**: Adapts to both debug and release builds
- **Fallback Support**: Uses default dimensions if dynamic sizing fails

### Window Control Functions

The window management system provides comprehensive control over the application window:

- **Resize by Ratio**: Set window size based on screen percentage
- **Specific Dimensions**: Set exact window width and height
- **Position Control**: Set window position on screen
- **Center Window**: Center the window on the screen
- **Maximize/Minimize**: Toggle window maximized and minimized states
- **Fullscreen Mode**: Toggle fullscreen mode
- **Close Window**: Close the application window

## Implementation Details

### Backend (Rust)

The window management features are implemented in the Tauri backend (`src-tauri/src/main.rs`):

1. **Dynamic Sizing Logic**: Added to the `setup` function to calculate optimal window dimensions
2. **Tauri Commands**: Exposed window management functions as Tauri commands
3. **Error Handling**: Comprehensive error handling with detailed logging
4. **Build Variants**: Separate logic for debug and release builds

### Frontend (React)

The frontend implementation consists of:

1. **Custom Hook**: `useWindowManagement.ts` provides a React hook for window management
2. **Test Component**: `WindowManagementTest.tsx` demonstrates all window management features
3. **UI Integration**: Integrated into the Dashboard Overview component

## Available Commands

The following Tauri commands are available for window management:

- `set_window_size_by_ratio`: Set window size as percentage of screen
- `set_window_size`: Set specific window dimensions
- `set_window_position`: Set window position
- `center_window`: Center window on screen
- `maximize_window`: Maximize the window
- `minimize_window`: Minimize the window
- `toggle_fullscreen`: Toggle fullscreen mode
- `close_window`: Close the application

## Usage

### Dynamic Window Sizing

The application automatically resizes on startup based on screen resolution. No user action is required.

### Manual Window Control

Users can access window management controls through the Dashboard Overview panel:

1. Navigate to the Dashboard
2. Find the "Window Management" card
3. Use the provided buttons and inputs to control the window

### Developer Usage

Developers can use the `useWindowManagement` hook in React components:

```typescript
import { useWindowManagement } from '@/hooks/useWindowManagement';

const MyComponent = () => {
  const { 
    setWindowSizeByRatio, 
    setWindowSize, 
    setWindowPosition,
    centerWindow,
    maximizeWindow,
    minimizeWindow,
    toggleFullscreen,
    closeWindow,
    isReady,
    error
  } = useWindowManagement();

  // Use any of the functions as needed
  return (
    <button onClick={() => setWindowSizeByRatio(0.8)}>
      Set window to 80% of screen size
    </button>
  );
};
```

## Permissions

Window management features require the following Tauri permissions in `src-tauri/capabilities/default.json`:

```json
{
  "permissions": [
    "core:window:default"
  ]
}
```

## Error Handling

All window management functions include error handling with user feedback through toast notifications. Errors are displayed in the UI when window operations fail.

## Testing

The `WindowManagementTest.tsx` component provides a comprehensive test interface for all window management features. This component is integrated into the Dashboard Overview for easy access during development and testing.
