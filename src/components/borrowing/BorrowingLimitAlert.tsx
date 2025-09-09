import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Book, User, Calendar } from 'lucide-react';

interface BorrowingLimitAlertProps {
  open: boolean;
  onClose: () => void;
  studentName: string;
  currentlyBorrowed: number;
  requestedBooks: number;
  maxAllowed: number;
  availableSlots: number;
}

export const BorrowingLimitAlert: React.FC<BorrowingLimitAlertProps> = ({
  open,
  onClose,
  studentName,
  currentlyBorrowed,
  requestedBooks,
  maxAllowed,
  availableSlots
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Borrowing Limit Exceeded
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600 mt-1">
                Unable to process book issuance request
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Student:</span>
              <span className="text-gray-700">{studentName}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Book className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="font-medium text-gray-700">Currently Borrowed</div>
                  <div className="text-lg font-semibold text-blue-600">{currentlyBorrowed}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Book className="h-4 w-4 text-green-500" />
                <div>
                  <div className="font-medium text-gray-700">Maximum Allowed</div>
                  <div className="text-lg font-semibold text-green-600">{maxAllowed}</div>
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Requesting to issue:</span>
                <span className="font-semibold text-gray-900">{requestedBooks} book(s)</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-600">Available slots:</span>
                <span className={`font-semibold ${availableSlots > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {availableSlots} book(s)
                </span>
              </div>
            </div>
          </div>

          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              {availableSlots > 0 ? (
                <>
                  You can issue up to <strong>{availableSlots}</strong> more book(s) to this student. 
                  Please reduce the number of books or ask the student to return some books first.
                </>
              ) : (
                <>
                  This student has reached the maximum borrowing limit. 
                  Books must be returned before issuing new ones.
                </>
              )}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full">
            I Understand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
