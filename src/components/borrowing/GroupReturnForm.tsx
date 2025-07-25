import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BookOpen, User, Calendar, AlertCircle, Users, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface GroupReturnFormProps {
  onSubmit: (returnData: any) => void;
  onCancel: () => void;
}

export const GroupReturnForm: React.FC<GroupReturnFormProps> = ({
  onSubmit,
  onCancel,
}) => {
  const { toast } = useToast();
  
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [isSearchingStudent, setIsSearchingStudent] = useState(false);
  const [isSearchingBook, setIsSearchingBook] = useState(false);
  const [groupBorrowing, setGroupBorrowing] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [conditionAtReturn, setConditionAtReturn] = useState('good');
  const [returnNotes, setReturnNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [theftAlert, setTheftAlert] = useState(false);

  // Calculate potential fines based on condition and overdue status
  const calculatePotentialFines = () => {
    if (!groupBorrowing) return { total: 0, breakdown: [] };
    
    const dueDate = new Date(groupBorrowing.due_date);
    const returnDate = new Date();
    const daysOverdue = Math.max(0, Math.ceil((returnDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    let total = 0;
    const breakdown = [];
    
    // Overdue fine
    if (daysOverdue > 0) {
      const overdueFine = daysOverdue * 10;
      total += overdueFine;
      breakdown.push(`Overdue: ${daysOverdue} days (KSh ${overdueFine})`);
    }
    
    // Condition fine
    let conditionFine = 0;
    switch (conditionAtReturn) {
      case 'fair':
        conditionFine = 50;
        break;
      case 'poor':
        conditionFine = 150;
        break;
      case 'damaged':
        conditionFine = 300;
        break;
      case 'lost':
        conditionFine = 500;
        break;
    }
    
    if (conditionFine > 0) {
      total += conditionFine;
      breakdown.push(`Condition (${conditionAtReturn}): KSh ${conditionFine}`);
    }
    
    return { total, breakdown, daysOverdue };
  };

  const fineInfo = calculatePotentialFines();

  // Search for student and their group borrowing
  const handleSearchStudent = async () => {
    if (!admissionNumber) {
      toast({
        title: "Missing Admission Number",
        description: "Please enter a student admission number to search.",
        variant: "destructive",
      });
      return;
    }

    setIsSearchingStudent(true);
    setStudent(null);
    setGroupBorrowing(null);
    setTheftAlert(false);
    
    try {
      // First find the student
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('admission_number', admissionNumber)
        .eq('status', 'active')
        .single();

      if (studentError || !studentData) {
        toast({
          title: "Student Not Found",
          description: "No active student found with that admission number.",
          variant: "destructive",
        });
        return;
      }

      setStudent(studentData);

      // Then find any active group borrowings for this student
      const { data: groupData, error: groupError } = await supabase
        .from('group_borrowings')
        .select('*, book_copies(*), books(*)')
        .eq('status', 'active')
        .contains('student_ids', [studentData.id]);

      if (groupError) {
        toast({
          title: "Error",
          description: "Failed to check group borrowings.",
          variant: "destructive",
        });
        return;
      }

      if (!groupData || groupData.length === 0) {
        toast({
          title: "No Group Borrowings",
          description: "This student is not part of any active group borrowings.",
          variant: "destructive",
        });
        return;
      }

      setGroupBorrowing(groupData[0]);
      toast({
        title: "Found Group Borrowing",
        description: `Found group borrowing for ${studentData.first_name} ${studentData.last_name}`,
      });
    } catch (error) {
      console.error('Error searching for student and group:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while searching.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingStudent(false);
    }
  };

  // Verify book copy for return
  const handleVerifyBookCopy = async () => {
    if (!trackingCode) {
      toast({
        title: "Missing Tracking Code",
        description: "Please enter a book copy tracking code to verify.",
        variant: "destructive",
      });
      return;
    }

    if (!groupBorrowing) {
      toast({
        title: "No Group Borrowing",
        description: "Please search for a student's group borrowing first.",
        variant: "destructive",
      });
      return;
    }

    setIsSearchingBook(true);
    setTheftAlert(false);

    try {
      // Check if the tracking code matches the borrowed book copy
      if (trackingCode !== groupBorrowing.tracking_code) {
        setTheftAlert(true);
        toast({
          title: "Potential Theft Alert",
          description: "This is not the book copy that was issued to the group!",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Book Copy Verified",
        description: "This is the correct book copy for return.",
      });
    } finally {
      setIsSearchingBook(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;

    if (!groupBorrowing) {
      toast({
        title: "Missing Group Borrowing",
        description: "Please search for a student's group borrowing first.",
        variant: "destructive",
      });
      return;
    }

    if (!trackingCode) {
      toast({
        title: "Missing Tracking Code",
        description: "Please enter and verify the book copy tracking code.",
        variant: "destructive",
      });
      return;
    }

    if (trackingCode !== groupBorrowing.tracking_code) {
      toast({
        title: "Invalid Book Copy",
        description: "The tracking code does not match the borrowed book copy.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const returnData = {
        group_borrowing_id: groupBorrowing.id,
        tracking_code: trackingCode,
        condition_at_return: conditionAtReturn,
        return_notes: returnNotes,
      };

      await onSubmit(returnData);
    } catch (error) {
      console.error('Error submitting group return:', error);
      toast({
        title: "Error",
        description: "Failed to process group return. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Student Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Find Group Borrowing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="admission_number">Student Admission Number *</Label>
                <Input
                  id="admission_number"
                  value={admissionNumber}
                  onChange={(e) => setAdmissionNumber(e.target.value)}
                  placeholder="Enter student admission number"
                  className="font-mono"
                />
              </div>
              <Button 
                type="button" 
                onClick={handleSearchStudent} 
                disabled={isSearchingStudent || !admissionNumber}
                className="mb-[1px]"
              >
                {isSearchingStudent ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-1" />
                    Search
                  </>
                )}
              </Button>
            </div>

            {student && groupBorrowing && (
              <div className="mt-4 space-y-4">
                {/* Student Info */}
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900">
                        {student.first_name} {student.last_name}
                      </p>
                      <p className="text-xs text-green-700">
                        {student.admission_number} • {student.class_grade}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Group Borrowing Info */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-900">
                        {groupBorrowing.books?.title}
                      </p>
                      <p className="text-sm text-blue-700">
                        by {groupBorrowing.books?.author}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                          Copy #{groupBorrowing.book_copies?.copy_number}
                        </Badge>
                        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                          Due: {new Date(groupBorrowing.due_date).toLocaleDateString()}
                        </Badge>
                      </div>
                      <p className="text-xs text-blue-600 mt-1 font-mono">
                        Tracking Code: {groupBorrowing.tracking_code}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Book Copy Verification */}
      {groupBorrowing && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              Verify Book Copy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="tracking_code">Book Copy Tracking Code *</Label>
                  <Input
                    id="tracking_code"
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value)}
                    placeholder="Enter tracking code to verify"
                    className="font-mono"
                  />
                </div>
                <Button 
                  type="button" 
                  onClick={handleVerifyBookCopy} 
                  disabled={isSearchingBook || !trackingCode}
                  className="mb-[1px]"
                >
                  {isSearchingBook ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-1" />
                      Verify
                    </>
                  )}
                </Button>
              </div>

              {theftAlert && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    WARNING: This is not the book copy that was issued to the group!
                    The correct tracking code is: {groupBorrowing.tracking_code}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Return Details */}
      {groupBorrowing && !theftAlert && trackingCode === groupBorrowing.tracking_code && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Return Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="condition_at_return">Condition at Return</Label>
                <Select value={conditionAtReturn} onValueChange={setConditionAtReturn}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="return_notes">Return Notes (Optional)</Label>
                <Textarea
                  id="return_notes"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Any notes about the condition or return..."
                  rows={3}
                  maxLength={500}
                />
              </div>

              {/* Fine Information */}
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800 font-medium">
                  Potential Fines
                </p>
                <div className="mt-2 text-sm text-yellow-700">
                  {fineInfo.breakdown.length === 0 ? (
                    <p>No fines applicable.</p>
                  ) : (
                    fineInfo.breakdown.map((line, index) => (
                      <div key={index}>{line}</div>
                    ))
                  )}
                </div>
                <div className="mt-2 font-semibold text-yellow-900">
                  Total Fine: KSh {fineInfo.total}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={!groupBorrowing || theftAlert || trackingCode !== groupBorrowing?.tracking_code || isSubmitting}
          className="min-w-[120px]"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </>
          ) : (
            'Process Group Return'
          )}
        </Button>
      </div>
    </form>
  );
};