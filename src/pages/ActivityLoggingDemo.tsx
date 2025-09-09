import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  useActivityLogger, 
  ActivityLoggerService, 
  usePerformanceLogger 
} from '@/hooks/useActivityLogger';
import { ActivityLogViewer } from '@/components/admin/ActivityLogViewer';

export const ActivityLoggingDemo: React.FC = () => {
  const { toast } = useToast();
  const { initLogger, logActivity } = useActivityLogger();
  
  // Log component mount performance
  usePerformanceLogger('ActivityLoggingDemo Mount');

  useEffect(() => {
    // Initialize the logger when component mounts
    const initializeLogger = async () => {
      try {
        await initLogger.mutateAsync('C:\\Users\\Denis Kariuki\\Downloads\\Compressed\\Desktop Application Libarary\\Desktop Application Libarary\\shelf-serpent-desktop\\logs');
        
        // Log that the demo page was accessed
        await ActivityLoggerService.logUI('Demo Page Access', 'ActivityLoggingDemo');
        
        toast({
          title: "Activity Logger Initialized",
          description: "Activity logging is now active",
          variant: "default"
        });
      } catch (error) {
        console.error('Failed to initialize activity logger:', error);
        toast({
          title: "Logger Initialization Failed",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive"
        });
      }
    };

    initializeLogger();
  }, []);

  const handleTestLog = async (logType: string) => {
    try {
      switch (logType) {
        case 'info':
          await ActivityLoggerService.logUI('Test Info Log', 'Demo Button', 'demo-user', {
            button_type: 'info',
            test_data: 'This is a test info log'
          });
          break;
          
        case 'warning':
          await logActivity.mutateAsync({
            level: 'warn',
            category: 'Test',
            action: 'Warning Log Test',
            details: { 
              message: 'This is a test warning',
              timestamp: new Date().toISOString()
            }
          });
          break;
          
        case 'error':
          await ActivityLoggerService.logError(
            new Error('This is a test error'),
            'Demo',
            'Error Log Test',
            'demo-user',
            { test_context: 'Activity logging demo' }
          );
          break;
          
        case 'auth':
          await ActivityLoggerService.logAuth(
            'login',
            'demo-user-123',
            'demo@example.com',
            { 
              login_method: 'demo',
              ip_address: '127.0.0.1',
              user_agent: navigator.userAgent
            }
          );
          break;
          
        case 'database':
          await ActivityLoggerService.logDatabase(
            'Create Record',
            'DemoBook',
            'demo-book-123',
            'demo-user',
            {
              operation: 'INSERT',
              table: 'books',
              affected_rows: 1
            }
          );
          break;
          
        case 'performance':
          // Simulate a performance-monitored operation
          const start = performance.now();
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
          const duration = performance.now() - start;
          
          await ActivityLoggerService.logPerformance(
            'Demo Operation',
            duration,
            'DemoComponent',
            {
              simulated: true,
              complexity: 'medium'
            }
          );
          break;
          
        case 'security':
          await ActivityLoggerService.logSecurity(
            'Suspicious Activity',
            'demo-user',
            '192.168.1.100',
            navigator.userAgent,
            {
              reason: 'Multiple failed login attempts',
              severity: 'medium',
              action_taken: 'account_locked'
            }
          );
          break;
      }
      
      toast({
        title: "Log Created",
        description: `${logType} log entry created successfully`,
        variant: "default"
      });
      
    } catch (error) {
      console.error(`Failed to create ${logType} log:`, error);
      toast({
        title: "Logging Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Activity Logging System Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            This page demonstrates the comprehensive activity logging system. 
            Click the buttons below to generate different types of log entries.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              onClick={() => handleTestLog('info')}
              variant="default"
            >
              Info Log
            </Button>
            
            <Button 
              onClick={() => handleTestLog('warning')}
              variant="outline"
            >
              Warning Log
            </Button>
            
            <Button 
              onClick={() => handleTestLog('error')}
              variant="destructive"
            >
              Error Log
            </Button>
            
            <Button 
              onClick={() => handleTestLog('auth')}
              variant="secondary"
            >
              Auth Log
            </Button>
            
            <Button 
              onClick={() => handleTestLog('database')}
              variant="default"
            >
              Database Log
            </Button>
            
            <Button 
              onClick={() => handleTestLog('performance')}
              variant="outline"
            >
              Performance Log
            </Button>
            
            <Button 
              onClick={() => handleTestLog('security')}
              variant="destructive"
            >
              Security Log
            </Button>
          </div>
        </CardContent>
      </Card>

      <ActivityLogViewer 
        defaultLimit={50}
        showExport={true}
        showClear={true}
        autoRefresh={true}
        refreshInterval={10000}
      />
    </div>
  );
};
