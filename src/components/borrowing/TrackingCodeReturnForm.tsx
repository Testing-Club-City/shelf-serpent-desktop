import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BookOpen, User, Calendar, AlertCircle, AlertTriangle, CheckCircle, BookX, Shield, Currency } from 'lucide-react';
import { TrackingCodeInput } from './TrackingCodeInput';
import { useBorrowings } from '@/hooks/useBorrowings';
import { useBookReturn } from '@/hooks/useBorrowings';
import { calculateConditionFine, getFineAmountBySetting } from '@/hooks/useFineManagement';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';

interface TrackingCodeReturnFormProps {
  onCancel: () => void;
}

export const TrackingCodeReturnForm: React.FC<TrackingCodeReturnFormProps> = ({
  onCancel,
}) => {
  const { data: borrowings } = useBorrowings();
  const bookReturn = useBookReturn();
  const { toast } = useToast();
  
  const [returnedTrackingCode, setReturnedTrackingCode] = useState('');
  const [returnedDate, setReturnedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [conditionAtReturn, setConditionAtReturn] = useState('good');
  const [returnNotes, setReturnNotes] = useState('');
  const [isLost, setIsLost] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [manualFineAmount, setManualFineAmount] = useState<number | null>(null);
  const [theftFineAmount, setTheftFineAmount] = useState<number>(800); // Default theft fine
  const [isProcessing, setIsProcessing] = useState(false);
  const [victimBorrowing, setVictimBorrowing] = useState<any>(null);
  const [isTheftConfirmed, setIsTheftConfirmed] = useState(false);
  
  // Find the borrowing record for the returned tracking code
  const activeBorrowings = (borrowings?.data || []).filter(b => b.status === 'active');
  const expectedBorrowing = activeBorrowings.find(b => 
    b.tracking_code?.toLowerCase() === returnedTrackingCode.toLowerCase().trim()
  );

  // Check if it's a different book (theft case)
  const isTheftCase = returnedTrackingCode.trim() && !expectedBorrowing && activeBorrowings.length > 0;
  
  // Load the default theft fine amount from settings
  useEffect(() => {
    const loadTheftFine = async () => {
      try {
        const fineAmount = await getFineAmountBySetting('stolen_book');
        if (fineAmount > 0) {
          setTheftFineAmount(fineAmount);
        }
      } catch (error) {
        console.error('Error loading theft fine amount:', error);
      }
    };
    
    loadTheftFine();
  }, []);

  // When a potential theft is detected, try to find the real owner of the book
  useEffect(() => {
    const findBookOwner = async () => {
      if (!returnedTrackingCode || !isTheftCase) {
        setVictimBorrowing(null);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('borrowings')
          .select(`
            *,
            students (id, first_name, last_name, admission_number, class_grade),
            books (id, title, author)
          `)
          .eq('tracking_code', returnedTrackingCode)
          .eq('status', 'active')
          .single();
          
        if (error) {
          console.error('Error finding book owner:', error);
          setVictimBorrowing(null);
          return;
        }
        
        if (data) {
          setVictimBorrowing(data);
        } else {
          setVictimBorrowing(null);
        }
      } catch (error) {
        console.error('Error querying book owner:', error);
        setVictimBorrowing(null);
      }
    };
    
    findBookOwner();
  }, [returnedTrackingCode, isTheftCase]);
  
  // Calculate days overdue
  const calculateDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const returned = new Date(returnedDate);
    const diffTime = returned.getTime() - due.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  // Get calculated fine amount
  const getCalculatedFine = () => {
    if (!expectedBorrowing) return 0;
    const daysOverdue = calculateDaysOverdue(expectedBorrowing.due_date);
    return calculateConditionFine(conditionAtReturn, daysOverdue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!returnedTrackingCode.trim()) return;
    setIsProcessing(true);

    try {
      // Use manual fine if provided, otherwise use calculated fine
      const finalFineAmount = manualFineAmount !== null ? manualFineAmount : getCalculatedFine();
      
      if (isTheftConfirmed && victimBorrowing) {
        // Process theft case - handle both the victim's book and the thief's original book
        
        // 1. Mark the victim's book as returned
        await bookReturn.mutateAsync({
          id: victimBorrowing.id,
          condition_at_return: conditionAtReturn,
          fine_amount: 0, // No fine for the victim
          notes: `Book was stolen and returned by another student. Original student is not at fault.`,
          is_lost: false,
          returned_tracking_code: returnedTrackingCode,
          prevent_auto_fine: true,
          book_verified: true
        });
        
        // 2. Create a fine for the thief (current student returning the wrong book)
        if (activeBorrowings.length > 0) {
          const thiefBorrowing = activeBorrowings[0]; // Use the first active borrowing for the thief
          
          // Create a fine record for the thief
          await supabase.from('fines').insert({
            student_id: thiefBorrowing.student_id,
            borrowing_id: thiefBorrowing.id,
            amount: theftFineAmount,
            fine_type: 'stolen_book',
            description: `Theft fine: Student returned book (${returnedTrackingCode}) belonging to ${victimBorrowing.students.first_name} ${victimBorrowing.students.last_name}`,
            status: 'unpaid',
            created_at: new Date().toISOString()
          });
          
          // 3. Mark the thief's original book as lost
          await bookReturn.mutateAsync({
            id: thiefBorrowing.id,
            condition_at_return: 'lost',
            fine_amount: 0, // We already added the theft fine separately
            notes: `Student returned another student's book (${returnedTrackingCode}) instead of this one. Marked as lost and theft fine issued.`,
            is_lost: true,
            lost_reason: 'Theft case: Student returned someone else\'s book',
            returned_tracking_code: '',
            prevent_auto_fine: true,
            book_verified: false
          });
          
          // 4. Create a theft report for tracking
          await supabase.from('theft_reports').insert({
            student_id: thiefBorrowing.student_id,
            book_id: victimBorrowing.book_id,
            book_copy_id: victimBorrowing.book_copy_id,
            borrowing_id: victimBorrowing.id,
            expected_tracking_code: thiefBorrowing.tracking_code,
            returned_tracking_code: returnedTrackingCode,
            reported_date: new Date().toISOString(),
            resolution_date: new Date().toISOString(),
            theft_reason: 'Student returned book belonging to another student',
            status: 'resolved',
            resolution_notes: `Theft detected during return process. Fine of ${formatCurrency(theftFineAmount)} issued to student.`
          });
        }
        
        toast({
          title: "Theft Case Processed",
          description: `The stolen book has been returned to its rightful owner and a fine has been issued to the student who took it.`,
          variant: "default",
        });
      } else if (isLost) {
        // Handle lost book case
        if (!expectedBorrowing) {
          setIsProcessing(false);
          return;
        }

        await bookReturn.mutateAsync({
          id: expectedBorrowing.id,
          condition_at_return: 'lost',
          fine_amount: finalFineAmount,
          notes: `Lost book: ${lostReason}. ${returnNotes}`,
          is_lost: true,
          returned_tracking_code: returnedTrackingCode,
          prevent_auto_fine: manualFineAmount !== null
        });
        
        toast({
          title: "Book Marked as Lost",
          description: `The book has been marked as lost and a fine of ${formatCurrency(finalFineAmount)} has been recorded.`,
        });
      } else if (expectedBorrowing) {
        // Normal return case - verify book matches
        await bookReturn.mutateAsync({
          id: expectedBorrowing.id,
          condition_at_return: conditionAtReturn,
          fine_amount: finalFineAmount,
          notes: returnNotes,
          is_lost: false,
          returned_tracking_code: returnedTrackingCode,
          prevent_auto_fine: manualFineAmount !== null
        });
        
        toast({
          title: "Book Returned Successfully",
          description: finalFineAmount > 0 
            ? `The book has been returned with a fine of ${formatCurrency(finalFineAmount)}.`
            : "The book has been returned successfully with no fine.",
        });
      } else {
        toast({
          title: "Return Failed",
          description: "Could not process the return. Please verify the tracking code.",
          variant: "destructive",
        });
      }

      onCancel();
    } catch (error) {
      console.error('Error processing return:', error);
      toast({
        title: "Error",
        description: "Failed to process the return. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const daysOverdue = expectedBorrowing ? calculateDaysOverdue(expectedBorrowing.due_date) : 0;
  const calculatedFine = getCalculatedFine();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tracking Code Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />
            Book Return with Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TrackingCodeInput
            value={returnedTrackingCode}
            onChange={(code) => {
              setReturnedTrackingCode(code);
              setIsTheftConfirmed(false); // Reset theft confirmation when code changes
            }}
            label="Returned Book Tracking Code"
            placeholder="Scan or enter the tracking code of the returned book"
            autoValidate={false}
          />
        </CardContent>
      </Card>

      {/* Book Verification Status */}
      {returnedTrackingCode.trim() && (
        <Card>
          <CardContent className="pt-6">
            {expectedBorrowing ? (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">✅ Book Verified Successfully</p>
                      <div className="text-sm space-y-1">
                        <p><span className="font-medium">Student:</span> {expectedBorrowing.students?.first_name} {expectedBorrowing.students?.last_name}</p>
                        <p><span className="font-medium">Book:</span> {expectedBorrowing.books?.title}</p>
                        <p><span className="font-medium">Expected Code:</span> <code>{expectedBorrowing.tracking_code}</code></p>
                        <p><span className="font-medium">Returned Code:</span> <code>{returnedTrackingCode}</code></p>
                        <p><span className="font-medium">Due Date:</span> {format(new Date(expectedBorrowing.due_date), 'MMM dd, yyyy')}</p>
                        {daysOverdue > 0 && (
                          <p className="text-red-600">
                            <span className="font-medium">Overdue:</span> {daysOverdue} days
                          </p>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            ) : victimBorrowing ? (
              <Alert variant="destructive">
                <Shield className="h-4 w-4" />
                <AlertTitle className="text-lg font-bold">⚠️ Book Belongs to Another Student</AlertTitle>
                <AlertDescription>
                  <div className="space-y-4 mt-2">
                    <p className="text-sm">
                      The returned book with tracking code <code className="bg-red-100 px-1 py-0.5 rounded">{returnedTrackingCode}</code> belongs 
                      to another student. This is a potential theft case.
                    </p>
                    
                    <div className="bg-white/20 p-3 rounded-md border border-red-400">
                      <h4 className="font-medium text-sm mb-2 underline">Book Owner Details:</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="font-medium">Student:</p>
                          <p>{victimBorrowing.students.first_name} {victimBorrowing.students.last_name}</p>
                        </div>
                        <div>
                          <p className="font-medium">Admission No:</p>
                          <p>{victimBorrowing.students.admission_number}</p>
                        </div>
                        <div>
                          <p className="font-medium">Class:</p>
                          <p>{victimBorrowing.students.class_grade}</p>
                        </div>
                        <div>
                          <p className="font-medium">Book:</p>
                          <p>{victimBorrowing.books.title}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-red-700 text-white p-3 rounded-md">
                      <h4 className="font-bold text-sm mb-1">Action Required:</h4>
                      <p className="text-sm">
                        The student returning this book will be fined for theft/misappropriation 
                        and their original book will be marked as lost.
                      </p>
                    </div>
                    
                    {!isTheftConfirmed && (
                      <div className="flex justify-end">
                        <Button 
                          type="button" 
                          variant="destructive"
                          onClick={() => setIsTheftConfirmed(true)}
                          className="gap-2"
                        >
                          <Shield className="h-4 w-4" />
                          Confirm Theft Case
                        </Button>
                      </div>
                    )}
                    
                    {isTheftConfirmed && (
                      <div className="bg-green-100 text-green-800 p-3 rounded-md">
                        <p className="text-sm font-medium">
                          ✓ Theft case confirmed. Complete the return to process this case.
                        </p>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ) : isTheftCase ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">⚠️ Book Verification Failed - Possible Theft</p>
                    <p className="text-sm">
                      The returned book <span className="font-mono font-bold">{returnedTrackingCode}</span> does not match any active borrowing.
                      This student may have returned a different book than what was borrowed.
                    </p>
                    {activeBorrowings.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium">Active borrowings to resolve:</p>
                        <div className="mt-1 space-y-1">
                          {activeBorrowings.slice(0, 3).map((borrowing) => (
                            <div key={borrowing.id} className="text-xs bg-red-50 p-2 rounded">
                              {borrowing.students?.first_name} {borrowing.students?.last_name}: <code>{borrowing.tracking_code}</code>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No active borrowing found for tracking code: <span className="font-mono font-bold">{returnedTrackingCode}</span>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Theft Details Section - only show when theft is confirmed */}
      {isTheftConfirmed && victimBorrowing && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-red-800">
              <Shield className="h-5 w-5" />
              Theft Case Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-md border border-red-200">
                  <h3 className="font-medium text-sm mb-2">Victim's Book (Being Returned)</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Student:</span> {victimBorrowing.students.first_name} {victimBorrowing.students.last_name}</p>
                    <p><span className="font-medium">Book:</span> {victimBorrowing.books.title}</p>
                    <p><span className="font-medium">Tracking Code:</span> <code>{victimBorrowing.tracking_code}</code></p>
                    <Badge variant="outline" className="mt-1 text-green-700 bg-green-50">Will be marked as returned</Badge>
                  </div>
                </div>
                
                <div className="bg-white p-3 rounded-md border border-red-200">
                  <h3 className="font-medium text-sm mb-2">Thief's Original Book</h3>
                  {activeBorrowings.length > 0 ? (
                    <div className="space-y-1 text-sm">
                      <p><span className="font-medium">Book:</span> {activeBorrowings[0].books?.title}</p>
                      <p><span className="font-medium">Tracking Code:</span> <code>{activeBorrowings[0].tracking_code}</code></p>
                      <Badge variant="outline" className="mt-1 text-red-700 bg-red-50">Will be marked as lost</Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No active borrowings found for this student.</p>
                  )}
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm">Theft Fine Amount</h3>
                  <p className="text-3xl font-bold text-red-700">{formatCurrency(theftFineAmount)}</p>
                </div>
                
                <div>
                  <Label htmlFor="theft_fine">Override Fine Amount (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="theft_fine"
                      type="number"
                      min="0"
                      step="10"
                      value={theftFineAmount}
                      onChange={(e) => setTheftFineAmount(parseFloat(e.target.value) || 0)}
                      className="w-36"
                    />
                    <Currency className="h-4 w-4 text-gray-500" />
                  </div>
                </div>
              </div>
              
              <div>
                <Label htmlFor="theft_notes">Additional Notes</Label>
                <Textarea
                  id="theft_notes"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Enter any additional notes about this theft case..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Return Details - Only show for normal returns or when no theft is confirmed */}
      {(expectedBorrowing || (!isTheftConfirmed && isTheftCase)) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Return Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="returned_date">Return Date</Label>
                  <Input
                    id="returned_date"
                    type="date"
                    value={returnedDate}
                    onChange={(e) => setReturnedDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label>Book Condition</Label>
                  <Select value={conditionAtReturn} onValueChange={setConditionAtReturn}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent (No fine)</SelectItem>
                      <SelectItem value="good">Good (No fine)</SelectItem>
                      <SelectItem value="fair">Fair (KES 50 fine)</SelectItem>
                      <SelectItem value="poor">Poor (KES 150 fine)</SelectItem>
                      <SelectItem value="damaged">Damaged (KES 300 fine)</SelectItem>
                      <SelectItem value="lost">Lost (KES 500 fine)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Fine Calculation Display */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm font-medium text-blue-800 mb-2">Fine Calculation:</p>
                <div className="text-sm text-blue-700 space-y-1">
                  {daysOverdue > 0 && (
                    <p>• Overdue fine: {daysOverdue} days × KES 10 = {formatCurrency(daysOverdue * 10)}</p>
                  )}
                  {conditionAtReturn !== 'excellent' && conditionAtReturn !== 'good' && (
                    <p>• Condition fine ({conditionAtReturn}): {formatCurrency(calculateConditionFine(conditionAtReturn, 0) - daysOverdue * 10)}</p>
                  )}
                  <p className="font-medium border-t border-blue-300 pt-1 mt-2">
                    Total calculated fine: {formatCurrency(calculatedFine)}
                  </p>
                </div>
              </div>

              {/* Manual Fine Override */}
              <div>
                <Label htmlFor="manual_fine">Manual Fine Override (Optional)</Label>
                <Input
                  id="manual_fine"
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualFineAmount || ''}
                  onChange={(e) => setManualFineAmount(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder={`Leave empty to use calculated fine (${formatCurrency(calculatedFine)})`}
                />
                <p className="text-xs text-gray-600 mt-1">
                  Override the automatic fine calculation if needed
                </p>
              </div>

              {/* Lost Book Handling */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_lost"
                    checked={isLost}
                    onChange={(e) => setIsLost(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="is_lost">Mark as lost book</Label>
                </div>

                {isLost && (
                  <div>
                    <Label htmlFor="lost_reason">Reason for Loss</Label>
                    <Textarea
                      id="lost_reason"
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                      placeholder="Explain how the book was lost..."
                      rows={2}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="return_notes">Return Notes (Optional)</Label>
                <Textarea
                  id="return_notes"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Any additional notes about the return..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={(!returnedTrackingCode.trim() || (!expectedBorrowing && !isTheftConfirmed)) || isProcessing}
          className={`min-w-[120px] ${isTheftConfirmed ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
        >
          {isProcessing ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
              Processing...
            </>
          ) : isTheftConfirmed ? (
            <>
              <Shield className="h-4 w-4 mr-1.5" />
              Process Theft Case
            </>
          ) : isLost ? (
            <>
              <BookX className="h-4 w-4 mr-1.5" />
              Process Lost Book
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-1.5" />
              Process Return
            </>
          )}
        </Button>
      </div>
    </form>
  );
};
