import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { Login } from "@/components/auth/Login";
import { Signup } from "@/components/auth/Signup";
import { useOfflineAuth, OfflineAuthProvider } from "@/hooks/useOfflineAuth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DocumentMetaProvider } from "@/hooks/useDocumentMetaContext";
import { BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';

// Ultra-fast React Query client with minimal overhead
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0, // Don't retry to speed up
      refetchOnWindowFocus: false, // Disable for speed
      staleTime: 30000, // 30 seconds
      refetchOnMount: false, // Speed up mounting
      networkMode: 'offlineFirst',
    },
  },
});

function FastApp() {
  const { isAuthenticated, loading } = useOfflineAuth();
  const [showApp, setShowApp] = useState(false);
  const [bypassAuth, setBypassAuth] = useState(false);
  
  // Ultra-fast loading bypass - show app immediately after timeout
  useEffect(() => {
    // For production builds, use shorter timeout
    const isProduction = import.meta.env.PROD;
    const timeout = isProduction ? 1500 : 500; // 1.5s for prod, 500ms for dev
    
    const timer = setTimeout(() => {
      console.log(`⚡ Fast loading bypass after ${timeout}ms - showing app immediately`);
      setShowApp(true);
      
      // If still loading after 3 seconds in production, bypass auth check
      if (isProduction && loading) {
        setTimeout(() => {
          if (loading) {
            console.warn('⚠️ Auth check timeout - bypassing to login screen');
            setBypassAuth(true);
          }
        }, 1500);
      }
    }, timeout);
    
    return () => clearTimeout(timer);
  }, [loading]);

  // Set document title immediately
  useEffect(() => {
    document.title = 'Library Management System';
  }, []);

  // Show loading screen briefly
  if (!showApp) {
    return (
      <div className="flex items-center justify-center min-h-[600px] bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-blue-600 animate-pulse" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Library Manager</h1>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      {loading && !showApp && !bypassAuth ? (
        <div className="flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-4 animate-pulse">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <p className="text-lg font-medium text-gray-700">Loading Library System...</p>
          </div>
        </div>
      ) : (
        <Routes>
          <Route 
            path="/login" 
            element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} 
          />
          <Route 
            path="/signup" 
            element={!isAuthenticated ? <Signup /> : <Navigate to="/dashboard" />} 
          />
          <Route 
            path="/dashboard/*" 
            element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/" 
            element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} 
          />
        </Routes>
      )}
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <OfflineAuthProvider>
          <DocumentMetaProvider>
            <Router>
              <FastApp />
            </Router>
          </DocumentMetaProvider>
        </OfflineAuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
