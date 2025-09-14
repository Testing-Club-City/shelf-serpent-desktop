import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { Login } from "@/components/auth/Login";
import { Signup } from "@/components/auth/Signup";
import { useOfflineAuth, OfflineAuthProvider } from "@/hooks/useOfflineAuth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DocumentMetaProvider } from "@/hooks/useDocumentMetaContext";
import { SplashScreen } from "@/components/SplashScreen";
import { useStartupSound } from "@/hooks/useStartupSound";
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
  const [showSplash, setShowSplash] = useState(true);
  const [showApp, setShowApp] = useState(false);
  
  // Play startup sound
  useStartupSound();
  
  // Set document title immediately
  useEffect(() => {
    document.title = 'Kisii School Library Management System';
  }, []);

  // Handle splash screen completion
  const handleSplashComplete = () => {
    setShowSplash(false);
    setShowApp(true);
  };

  // Show splash screen first
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <div className="bg-background min-h-screen">
      {loading && !showApp ? (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-4 animate-pulse">
              <img src="/tamnet-logo.png" alt="Tamnet" className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium text-gray-700">Finalizing setup...</p>
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
