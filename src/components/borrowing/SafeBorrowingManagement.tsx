import React from 'react';
import { BorrowingManagement } from './BorrowingManagement';

interface SafeBorrowingManagementProps {
  initialTab?: string;
}

export const SafeBorrowingManagement: React.FC<SafeBorrowingManagementProps> = (props) => {
  try {
    return <BorrowingManagement {...props} />;
  } catch (error) {
    console.error('Borrowing Management Error:', error);
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold mb-4">Loading Issue</h2>
        <p className="text-gray-600 mb-4">There was an issue loading the borrowing management page.</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Reload Page
        </button>
      </div>
    );
  }
};