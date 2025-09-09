
import { useState } from 'react';
import { useOfflineAuth } from '@/hooks/useOfflineAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSystemSettings, getSchoolNameFromSettings } from '@/hooks/useSystemSettings';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useOfflineAuth();
  const { toast } = useToast();
  const { data: systemSettings } = useSystemSettings();

  // Get school name from system settings, fallback to default
  const schoolName = getSchoolNameFromSettings(systemSettings || []) || 'Library Management System';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (!success) {
        toast({
          title: 'Login Failed',
          description: 'Invalid credentials. Please check your email and password.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred during login.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        {/* Enhanced Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-6 shadow-lg">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{schoolName}</h1>
          <p className="text-gray-600 text-lg">Library Management System</p>
        </div>

        {/* Enhanced Login Card */}
        <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center font-bold text-gray-900">Welcome Back</CardTitle>
            <CardDescription className="text-center text-gray-600">
              Sign in to manage your library system
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-12 px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing In...</span>
                  </div>
                ) : (
                  'Sign In to Library System'
                )}
              </Button>              
              {/* Librarian Account Creation */}
              <div className="space-y-4 mt-6 pt-4 border-t border-gray-200">
                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Need a librarian account?{' '}
                    <Link to="/signup" className="text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                      Sign up
                    </Link>
                  </p>
                </div>
              </div>
              
              {/* Footer */}
              <div className="text-center mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Powered by {schoolName} &copy; 2025
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
        
        {/* Additional Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Secure • Reliable • Easy to Use
          </p>
        </div>
      </div>
    </div>
  );
};
