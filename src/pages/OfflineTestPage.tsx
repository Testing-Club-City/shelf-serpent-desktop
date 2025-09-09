import React from 'react';
import { OfflineReturnTest } from '@/components/OfflineReturnTest';

export const OfflineTestPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Offline Book Return Test
          </h1>
          <p className="text-gray-600">
            Test the offline-first book return functionality. 
            Disconnect your internet to test offline mode.
          </p>
        </div>
        
        <OfflineReturnTest />
      </div>
    </div>
  );
};
