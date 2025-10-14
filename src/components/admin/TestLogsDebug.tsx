import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const TestLogsDebug = () => {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testGetLogs = async () => {
    try {
      setError(null);
      console.log('🧪 Testing get_activity_logs command...');
      
      const data = await invoke('get_activity_logs', { limit: 10 });
      
      console.log('✅ Success! Raw data:', data);
      console.log('📊 Data type:', typeof data);
      console.log('📦 Is Array:', Array.isArray(data));
      console.log('📏 Length:', Array.isArray(data) ? data.length : 'N/A');
      
      if (Array.isArray(data) && data.length > 0) {
        console.log('🔍 First item:', data[0]);
      }
      
      setResult({
        success: true,
        dataType: typeof data,
        isArray: Array.isArray(data),
        length: Array.isArray(data) ? data.length : null,
        data: data,
        firstItem: Array.isArray(data) && data.length > 0 ? data[0] : null
      });
      
    } catch (err: any) {
      console.error('❌ Error:', err);
      setError(err.message || String(err));
      setResult({
        success: false,
        error: err.message || String(err)
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Activity Logs Debug Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={testGetLogs}>
          Test get_activity_logs Command
        </Button>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <h3 className="font-semibold text-red-800">Error:</h3>
            <pre className="text-sm text-red-600 mt-2">{error}</pre>
          </div>
        )}
        
        {result && (
          <div className="bg-gray-50 border border-gray-200 rounded p-4">
            <h3 className="font-semibold mb-2">Result:</h3>
            <pre className="text-xs overflow-auto max-h-96 bg-white p-3 rounded border">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
        
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Check the browser console for detailed logs!</strong></p>
          <p>Look for messages starting with 🧪, ✅, ❌, etc.</p>
        </div>
      </CardContent>
    </Card>
  );
};
