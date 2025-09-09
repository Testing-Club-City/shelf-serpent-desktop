import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BookOpen, 
  Search, 
  User, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  ArrowLeft,
  Shield,
  Users,
  Calendar,
  FileText
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

interface BorrowingRecord {
  id: string;
  student_id?: string;
  staff_id?: string;
  status: string;
  borrowed_date: string;
  due_date?: string;
  returned_date?: string;
  tracking_code?: string;
  borrower_type: string;
  notes?: string;
  book: {
    legacy_book_id: number;
    title: string;
    author: string;
    copy_identifier?: string;
    condition?: string;
    status?: string;
  };
  borrower: {
    type: 'student' | 'staff';
    id: string;
    first_name?: string;
    last_name?: string;
    admission_number?: string;
    class_grade?: string;
    employee_id?: string;
    department?: string;
  } | null;
}

interface SearchResult {
  found: boolean;
  book?: {
    legacy_book_id: number;
    title: string;
    author: string;
    copy_identifier?: string;
    condition?: string;
    status?: string;
  };
  borrowings: BorrowingRecord[];
  total_borrowings: number;
  active_borrowings: number;
  has_active_borrowing: boolean;
  latest_borrowing?: BorrowingRecord;
}

interface Props {
  onCancel: () => void;
  onSubmit: (returnData: any) => Promise<void>;
}

export const EnhancedBookReturnForm: React.FC<Props> = ({ onCancel, onSubmit }) => {
  const [legacyBookId, setLegacyBookId] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBorrowing, setSelectedBorrowing] = useState<BorrowingRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Return form fields
  const [conditionAtReturn, setConditionAtReturn] = useState('good');
  const [returnNotes, setReturnNotes] = useState('');
  const [manualFineAmount, setManualFineAmount] = useState<number | null>(null);

  const handleSearch = async () => {
    if (!legacyBookId.trim()) {
      toast({
        title: "Missing Book ID",
        description: "Please enter a legacy book ID to search.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setSearchResult(null);
    setSelectedBorrowing(null);

    try {
      const result = await invoke('find_borrowing_by_legacy_book_id', {
        legacyBookId: legacyBookId.trim()
      }) as SearchResult;

      console.log('📚 Search result:', result);

      if (result.found) {
        setSearchResult(result);
        
        // If there's an active borrowing, select it by default
        if (result.has_active_borrowing && result.latest_borrowing?.status === 'active') {
          setSelectedBorrowing(result.latest_borrowing);
        }

        toast({
          title: "Book Found",
          description: `Found "${result.book?.title}" with ${result.total_borrowings} borrowing record(s)`,
        });
      } else {
        toast({
          title: "Book Not Found",
          description: `No book found with legacy ID: ${legacyBookId}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error searching for book:', error);
      toast({
        title: "Search Error",
        description: "Failed to search for the book. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getDaysOverdue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getBorrowerDisplayName = (borrower: BorrowingRecord['borrower']) => {
    if (!borrower) return 'Unknown';
    if (borrower.type === 'student') {
      return `${borrower.first_name || ''} ${borrower.last_name || ''}`.trim() || 'Unknown Student';
    } else {
      return `${borrower.first_name || ''} ${borrower.last_name || ''}`.trim() || 'Unknown Staff';
    }
  };

  const getBorrowerDetails = (borrower: BorrowingRecord['borrower']) => {
    if (!borrower) return 'No details available';
    if (borrower.type === 'student') {
      return `Admission: ${borrower.admission_number || 'N/A'} | Class: ${borrower.class_grade || 'N/A'}`;
    } else {
      return `Employee ID: ${borrower.employee_id || 'N/A'} | Department: ${borrower.department || 'N/A'}`;
    }
  };

  const handleReturn = async () => {
    if (!selectedBorrowing) {
      toast({
        title: "No Borrowing Selected",
        description: "Please select a borrowing record to return.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const returnData = {
        borrowing_id: selectedBorrowing.id,
        returned_date: new Date().toISOString(),
        status: 'returned',
        condition_at_return: conditionAtReturn,
        return_notes: returnNotes.trim() || null,
        fine_amount: manualFineAmount || 0,
        returned_by: null,
        copy_condition: conditionAtReturn,
        is_lost: false,
        book_verified: true,
        prevent_auto_fine: manualFineAmount !== null
      };

      await onSubmit(returnData);

      toast({
        title: "Book Returned Successfully",
        description: `The book has been returned ${manualFineAmount ? `with a fine of ${formatCurrency(manualFineAmount)}` : 'with no fine'}.`,
      });

      // Reset form
      setLegacyBookId('');
      setSearchResult(null);
      setSelectedBorrowing(null);
      setConditionAtReturn('good');
      setReturnNotes('');
      setManualFineAmount(null);
      
    } catch (error) {
      console.error('Error processing return:', error);
      toast({
        title: "Return Failed",
        description: "Failed to process the book return. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Enhanced Book Return</h2>
            <p className="text-gray-600">Search by legacy book ID to view borrowing history and process returns</p>
          </div>
        </div>
        <Button variant="outline" onClick={onCancel} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Book by Legacy ID
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="legacy-book-id">Legacy Book ID</Label>
              <Input
                id="legacy-book-id"
                value={legacyBookId}
                onChange={(e) => setLegacyBookId(e.target.value)}
                placeholder="Enter legacy book ID (e.g., 1234, 5678)"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="font-mono"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleSearch} 
                disabled={isSearching || !legacyBookId.trim()}
                className="min-w-[120px]"
              >
                {isSearching ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResult && (
        <div className="space-y-6">
          {/* Book Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Book Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-lg">{searchResult.book?.title}</h3>
                  <p className="text-gray-600">by {searchResult.book?.author}</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><span className="font-medium">Legacy ID:</span> {searchResult.book?.legacy_book_id}</p>
                    {searchResult.book?.copy_identifier && (
                      <p><span className="font-medium">Copy ID:</span> {searchResult.book.copy_identifier}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {searchResult.total_borrowings} Total Borrowings
                    </Badge>
                    {searchResult.has_active_borrowing && (
                      <Badge variant="default" className="bg-green-600">
                        Currently Borrowed
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      Condition: {searchResult.book?.condition || 'Unknown'}
                    </Badge>
                    <Badge variant="outline">
                      Status: {searchResult.book?.status || 'Unknown'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Borrowing History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Borrowing History ({searchResult.borrowings.length} records)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {searchResult.borrowings.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No borrowing records found for this book.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResult.borrowings.map((borrowing, index) => (
                    <div
                      key={borrowing.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedBorrowing?.id === borrowing.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      } ${borrowing.status === 'active' ? 'ring-2 ring-green-200' : ''}`}
                      onClick={() => borrowing.status === 'active' && setSelectedBorrowing(borrowing)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              {borrowing.borrower?.type === 'student' ? (
                                <User className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Users className="h-4 w-4 text-purple-600" />
                              )}
                              <span className="font-medium">{getBorrowerDisplayName(borrowing.borrower)}</span>
                            </div>
                            <Badge 
                              variant={borrowing.status === 'active' ? 'default' : 'secondary'}
                              className={borrowing.status === 'active' ? 'bg-green-600' : ''}
                            >
                              {borrowing.status}
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>{getBorrowerDetails(borrowing.borrower)}</p>
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Borrowed: {formatDate(borrowing.borrowed_date)}
                              </span>
                              {borrowing.due_date && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Due: {formatDate(borrowing.due_date)}
                                  {borrowing.status === 'active' && getDaysOverdue(borrowing.due_date) > 0 && (
                                    <Badge variant="destructive" className="ml-1 text-xs">
                                      {getDaysOverdue(borrowing.due_date)} days overdue
                                    </Badge>
                                  )}
                                </span>
                              )}
                              {borrowing.returned_date && (
                                <span className="flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Returned: {formatDate(borrowing.returned_date)}
                                </span>
                              )}
                            </div>
                            {borrowing.tracking_code && (
                              <p className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                Tracking: {borrowing.tracking_code}
                              </p>
                            )}
                            {borrowing.notes && (
                              <p className="text-xs italic">{borrowing.notes}</p>
                            )}
                          </div>
                        </div>
                        
                        {borrowing.status === 'active' && (
                          <div className="ml-4">
                            <Button 
                              size="sm" 
                              variant={selectedBorrowing?.id === borrowing.id ? "default" : "outline"}
                              onClick={() => setSelectedBorrowing(borrowing)}
                            >
                              {selectedBorrowing?.id === borrowing.id ? 'Selected for Return' : 'Select for Return'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Return Form */}
          {selectedBorrowing && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Process Return for {getBorrowerDisplayName(selectedBorrowing.borrower)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Selected borrowing details */}
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">Processing return for:</p>
                        <div className="text-sm space-y-1">
                          <p><span className="font-medium">Borrower:</span> {getBorrowerDisplayName(selectedBorrowing.borrower)} ({selectedBorrowing.borrower?.type})</p>
                          <p><span className="font-medium">Book:</span> {searchResult.book?.title}</p>
                          <p><span className="font-medium">Borrowed:</span> {formatDate(selectedBorrowing.borrowed_date)}</p>
                          {selectedBorrowing.due_date && (
                            <p><span className="font-medium">Due:</span> {formatDate(selectedBorrowing.due_date)}</p>
                          )}
                          {selectedBorrowing.due_date && getDaysOverdue(selectedBorrowing.due_date) > 0 && (
                            <p className="text-red-600">
                              <span className="font-medium">Overdue by:</span> {getDaysOverdue(selectedBorrowing.due_date)} days
                            </p>
                          )}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>

                  {/* Return form fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="condition">Condition at Return</Label>
                      <select
                        id="condition"
                        value={conditionAtReturn}
                        onChange={(e) => setConditionAtReturn(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="poor">Poor</option>
                        <option value="damaged">Damaged</option>
                        <option value="lost">Lost</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="fine">Manual Fine Amount (optional)</Label>
                      <Input
                        id="fine"
                        type="number"
                        step="0.01"
                        min="0"
                        value={manualFineAmount || ''}
                        onChange={(e) => setManualFineAmount(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="Leave empty for auto-calculation"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes">Return Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      placeholder="Any additional notes about the return..."
                      rows={3}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setSelectedBorrowing(null)}
                    >
                      Cancel Return
                    </Button>
                    <Button 
                      onClick={handleReturn}
                      disabled={isProcessing}
                      className="min-w-[150px]"
                    >
                      {isProcessing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Complete Return
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedBookReturnForm;
