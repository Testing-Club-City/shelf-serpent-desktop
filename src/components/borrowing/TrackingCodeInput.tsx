
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Check, X, Search, Users, BookCopy } from 'lucide-react';
import { useTrackingCodeSearch } from '@/hooks/useTrackingCodeSearch';

interface TrackingCodeInputProps {
  value: string;
  onChange: (value: string, copyData?: any) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  autoValidate?: boolean;
}

export const TrackingCodeInput: React.FC<TrackingCodeInputProps> = ({
  value,
  onChange,
  label = "Book Tracking Code",
  placeholder = "Enter or scan tracking code (e.g., KID2/004/25)",
  disabled = false,
  autoValidate = true
}) => {
  const [selectedCopy, setSelectedCopy] = useState<any>(null);
  
  const { data: searchResult, isLoading } = useTrackingCodeSearch(value);

  useEffect(() => {
    if (searchResult?.type === 'exact') {
      setSelectedCopy(searchResult.data);
      onChange(value, searchResult.data);
    } else {
      setSelectedCopy(null);
      onChange(value, null);
    }
  }, [searchResult, value, onChange]);

  const getInputStyles = () => {
    if (!autoValidate || !value.trim()) return '';
    
    if (isLoading) return 'border-blue-300 bg-blue-50';
    
    switch (searchResult?.type) {
      case 'exact':
        return 'border-green-500 bg-green-50';
      case 'book_code':
      case 'book_copies':
        return 'border-yellow-500 bg-yellow-50';
      case 'none':
        return value.length > 2 ? 'border-red-500 bg-red-50' : '';
      default:
        return '';
    }
  };

  const getStatusIcon = () => {
    if (isLoading) return <Search className="h-4 w-4 text-blue-500 animate-pulse" />;
    
    switch (searchResult?.type) {
      case 'exact':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'book_code':
      case 'book_copies':
        return <Search className="h-4 w-4 text-yellow-500" />;
      case 'none':
        return value.length > 2 ? <X className="h-4 w-4 text-red-500" /> : null;
      default:
        return null;
    }
  };

  const renderSearchResults = () => {
    if (!searchResult || !value.trim()) return null;

    switch (searchResult.type) {
      case 'exact':
        return (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <BookOpen className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-green-900">{searchResult.data.books?.title}</h4>
                <p className="text-sm text-green-700">by {searchResult.data.books?.author}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    Copy #{searchResult.data.copy_number}
                  </Badge>
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    {searchResult.data.condition || 'Good'}
                  </Badge>
                  <Badge className="bg-green-100 text-green-800">
                    Available
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        );

      case 'book_code':
        const bookGroups = searchResult.data;
        return (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                Books matching "{searchResult.searchTerm}"
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.values(bookGroups).map((group: any) => (
                <div key={group.book.id} className="p-2 bg-white rounded border">
                  <h5 className="font-medium text-gray-900">{group.book.title}</h5>
                  <p className="text-sm text-gray-600">by {group.book.author}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {group.totalCopies} available copies
                    </Badge>
                    <span className="text-xs text-gray-500">
                      Continue typing copy number (e.g., /{group.copies[0]?.copy_number.toString().padStart(3, '0')})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'book_copies':
        const copies = searchResult.data;
        return (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <BookCopy className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                Copies matching "{searchResult.searchTerm}"
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {copies.map((copy: any) => (
                <div 
                  key={copy.id} 
                  className="p-2 bg-white rounded border cursor-pointer hover:bg-gray-50"
                  onClick={() => {
                    onChange(copy.tracking_code, copy);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium text-gray-900">{copy.books?.title}</h5>
                      <p className="text-sm text-gray-600">Copy #{copy.copy_number}</p>
                      <span className="text-xs text-blue-600 font-mono">{copy.tracking_code}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {copy.condition || 'Good'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Click a copy or continue typing for exact match
            </p>
          </div>
        );

      case 'none':
        return value.length > 2 ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-700">
                No available books found matching: <span className="font-mono">{value}</span>
              </span>
            </div>
          </div>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="tracking-code">{label}</Label>
      <div className="relative">
        <Input
          id="tracking-code"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={placeholder}
          disabled={disabled}
          className={`font-mono ${getInputStyles()}`}
        />
        
        {autoValidate && (value.trim() || isLoading) && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {getStatusIcon()}
          </div>
        )}
      </div>

      {renderSearchResults()}
    </div>
  );
};
