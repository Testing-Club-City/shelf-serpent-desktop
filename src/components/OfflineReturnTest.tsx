import React, { useState } from 'react';
import { useBorrowingsArray, useBookReturn } from '@/hooks/useBorrowings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Wifi, WifiOff, CheckCircle, AlertCircle } from 'lucide-react';

export const OfflineReturnTest = () => {
  const { data: borrowings, isLoading, error } = useBorrowingsArray();
  const bookReturn = useBookReturn();
  const { toast } = useToast();
  
  const [selectedBorrowing, setSelectedBorrowing] = useState<any>(null);
  const [condition, setCondition] = useState('good');
  const [notes, setNotes] = useState('');

  // Filter active borrowings
  const activeBorrowings = borrowings?.filter(b => b.status === 'active') || [];

  const handleReturn = async () => {
    if (!selectedBorrowing) {
      toast({
        title: "No Borrowing Selected",
        description: "Please select a borrowing to return",
        variant: "destructive"
      });
      return;
    }

    try {
      await bookReturn.mutateAsync({
        id: selectedBorrowing.id,
        condition_at_return: condition,
        notes: notes,
        fine_amount: 0,
        is_lost: false
      });
      
      // Reset form
      setSelectedBorrowing(null);
      setCondition('good');
      setNotes('');
    } catch (error) {
      console.error('Return failed:', error);
    }
  };

  const getConnectionStatus = () => {
    // Simple check - if we have data, we're likely online
    // In a real app, you'd use a proper connection status hook
    return borrowings && borrowings.length > 0;
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading borrowings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center text-red-600">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Error loading borrowings: {error.message}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getConnectionStatus() ? (
              <>
                <Wifi className="h-5 w-5 text-green-600" />
                <span>Online Mode</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Connected
                </Badge>
              </>
            ) : (
              <>
                <WifiOff className="h-5 w-5 text-orange-600" />
                <span>Offline Mode</span>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  Offline
                </Badge>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            {getConnectionStatus() 
              ? "Connected to Supabase. Returns will be processed online."
              : "Using local database. Returns will be saved locally and synced when online."
            }
          </p>
        </CardContent>
      </Card>

      {/* Borrowings List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Active Borrowings ({activeBorrowings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeBorrowings.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No active borrowings found</p>
          ) : (
            <div className="space-y-2">
              {activeBorrowings.slice(0, 5).map((borrowing) => (
                <div 
                  key={borrowing.id} 
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedBorrowing?.id === borrowing.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedBorrowing(borrowing)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{borrowing.books?.title || 'Unknown Book'}</p>
                      <p className="text-sm text-gray-600">
                        Student: {borrowing.students?.first_name} {borrowing.students?.last_name}
                        {borrowing.students?.admission_number && ` (${borrowing.students.admission_number})`}
                      </p>
                      <p className="text-xs text-gray-500">
                        Due: {new Date(borrowing.due_date).toLocaleDateString()}
                        {borrowing.tracking_code && ` • Code: ${borrowing.tracking_code}`}
                      </p>
                    </div>
                    <Badge variant={new Date(borrowing.due_date) < new Date() ? "destructive" : "secondary"}>
                      {new Date(borrowing.due_date) < new Date() ? 'Overdue' : 'Active'}
                    </Badge>
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
              Return Book: {selectedBorrowing.books?.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Book Condition</label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellent - Like new</SelectItem>
                  <SelectItem value="good">Good - Minor wear</SelectItem>
                  <SelectItem value="fair">Fair - Noticeable wear</SelectItem>
                  <SelectItem value="poor">Poor - Significant wear</SelectItem>
                  <SelectItem value="damaged">Damaged - Needs repair</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Return Notes (Optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about the return..."
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleReturn}
                disabled={bookReturn.isPending}
                className="flex-1"
              >
                {bookReturn.isPending ? 'Processing...' : 'Return Book'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedBorrowing(null);
                  setCondition('good');
                  setNotes('');
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs space-y-1 text-gray-600">
            <p>Total borrowings loaded: {borrowings?.length || 0}</p>
            <p>Active borrowings: {activeBorrowings.length}</p>
            <p>Data source: {getConnectionStatus() ? 'Supabase (Online)' : 'SQLite (Offline)'}</p>
            <p>Return mutation status: {bookReturn.isPending ? 'Processing' : 'Ready'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
