
import { Login } from '@/components/auth/Login';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { useAuth } from '@/hooks/useAuth';
import { useSystemSettings, getSchoolNameFromSettings } from '@/hooks/useSystemSettings';
import { BookOpen } from 'lucide-react';
import { useEffect } from 'react';

const Index = () => {
  const { isAuthenticated, loading } = useAuth();
  const { data: systemSettings, isLoading: settingsLoading, refetch: refetchSettings } = useSystemSettings();
  
  // Only get school name if authenticated and settings are available
  const schoolName = isAuthenticated && systemSettings 
    ? getSchoolNameFromSettings(systemSettings) 
    : 'Library Management System';

  // Force refetch settings when component mounts and user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refetchSettings();
    }
  }, [refetchSettings, isAuthenticated]);

  if (loading || (isAuthenticated && settingsLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-6 shadow-lg">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{schoolName}</h1>
          <p className="text-gray-600 text-lg mb-6">Library Management System</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your library system...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <Dashboard />;
};

export default Index;
