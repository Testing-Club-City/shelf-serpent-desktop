import React from 'react';
import { useOfflineData } from '@/providers/OfflineDataProvider';
import { useConnectivity } from '@/hooks/useConnectivity';
import { Book, Category } from '@/types/offline';

export const OfflineTest: React.FC = () => {
  const { 
    books, 
    booksLoading, 
    booksError,
    categories, 
    categoriesLoading, 
    categoriesError,
    isDataAvailable,
    isOnline,
    isOffline 
  } = useOfflineData();

  const connectivity = useConnectivity();

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-4">Offline-First Test Dashboard</h2>
        
        {/* Connectivity Status */}
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Connectivity Status</h3>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
            connectivity.isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {connectivity.isOnline ? '🟢 Online' : '🔴 Offline'}
          </div>
        </div>

        {/* Data Availability */}
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Data Availability</h3>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
            isDataAvailable ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {isDataAvailable ? '✅ Data Available' : '⚠️ No Data Available'}
          </div>
        </div>

        {/* Books Section */}
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Books</h3>
          {booksLoading ? (
            <div className="text-gray-500">Loading books...</div>
          ) : booksError ? (
            <div className="text-red-500">Error: {booksError.message}</div>
          ) : (
            <div className="text-sm text-gray-600">
              Found {books.length} books
              {books.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {books.slice(0, 3).map((book: Book) => (
                    <li key={book.id} className="text-xs">
                      📚 {book.title} by {book.author}
                    </li>
                  ))}
                  {books.length > 3 && <li className="text-xs">...and {books.length - 3} more</li>}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Categories Section */}
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Categories</h3>
          {categoriesLoading ? (
            <div className="text-gray-500">Loading categories...</div>
          ) : categoriesError ? (
            <div className="text-red-500">Error: {categoriesError.message}</div>
          ) : (
            <div className="text-sm text-gray-600">
              Found {categories.length} categories
              {categories.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {categories.slice(0, 3).map((category: Category) => (
                    <li key={category.id} className="text-xs">
                      📂 {category.name}
                    </li>
                  ))}
                  {categories.length > 3 && <li className="text-xs">...and {categories.length - 3} more</li>}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Test Instructions</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>1. Disconnect from internet to test offline mode</li>
            <li>2. Check if books and categories still load</li>
            <li>3. Verify authentication works offline</li>
            <li>4. Reconnect to test sync functionality</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
