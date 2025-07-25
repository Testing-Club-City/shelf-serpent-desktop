import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { Login } from "@/components/auth/Login";
import { Signup } from "@/components/auth/Signup";
import { useAuth, AuthProvider } from "@/hooks/useAuth";
import { useSystemSettings, getSchoolNameFromSettings } from "@/hooks/useSystemSettings";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BookOpen } from 'lucide-react';
import { useEffect } from 'react';
import { DocumentMetaProvider, useDocumentMetaContext } from '@/hooks/useDocumentMetaContext';

// Create a client for React Query with better cache management
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 10000, // 10 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  },
});

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  
  // Always fetch system settings to get school name, even before authentication
  const { data: systemSettings, isLoading: settingsLoading, refetch: refetchSettings } = useSystemSettings();
  
  // Get school name from system settings, with fallback
  const schoolName = systemSettings && systemSettings.length > 0
    ? getSchoolNameFromSettings(systemSettings) 
    : 'Library Management System';
    
  const { updatePageState } = useDocumentMetaContext();
  
  // Update page state based on loading state
  useEffect(() => {
    updatePageState(loading || settingsLoading ? 'loading' : 'idle');
  }, [loading, settingsLoading, updatePageState]);

  // Force refetch settings when app loads
  useEffect(() => {
    refetchSettings();
  }, [refetchSettings]);

  // Update document title based on school name
  useEffect(() => {
    document.title = `${schoolName} - Library Management System`;
  }, [schoolName]);

  // Show loading screen while auth is loading, or while we're fetching critical data
  if (loading || (!systemSettings && settingsLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-6 shadow-lg">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{schoolName}</h1>
          <p className="text-gray-600 text-lg mb-6">Library Management System</p>
          <div className="w-16 h-16 border-4 border-blue-600 border-solid rounded-full border-t-transparent animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your library system...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate to="/" /> : <Signup />} />
      <Route path="/*" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
    </Routes>
  );
}

function AppWithProviders() {
  const { data: systemSettings } = useSystemSettings();
  const schoolName = getSchoolNameFromSettings(systemSettings || []);
  
  return (
    <DocumentMetaProvider schoolName={schoolName} baseTitle="Library Management System">
      <AppContent />
    </DocumentMetaProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <AppWithProviders />
            <Toaster />
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
