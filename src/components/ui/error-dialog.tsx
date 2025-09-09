import * as React from "react";
import { AlertCircle, BookOpen, X, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Button } from "./button";
import { useNavigate } from "react-router-dom";

interface ErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  errorType?: "borrowing" | "foreign_key" | "general";
  studentId?: string;
  studentName?: string;
  borrowings?: Array<{
    id: string;
    tracking_code?: string;
    book_title?: string;
  }>;
}

export function ErrorDialog({
  open,
  onOpenChange,
  title,
  description,
  errorType = "general",
  studentId,
  studentName,
  borrowings = [],
}: ErrorDialogProps) {
  const navigate = useNavigate();

  const handleViewBorrowings = () => {
    if (studentId) {
      navigate(`/students/${studentId}`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-gray-700">
            {description}
          </DialogDescription>
        </DialogHeader>
        
        {errorType === "borrowing" && borrowings.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
            <h4 className="font-medium flex items-center gap-1.5 text-amber-800">
              <BookOpen className="h-4 w-4" />
              Active Borrowings
            </h4>
            <ul className="mt-2 space-y-1 text-sm text-amber-800">
              {borrowings.map((borrowing, index) => (
                <li key={borrowing.id} className="flex items-center gap-1">
                  <span>•</span>
                  <span>{borrowing.book_title || `Book #${borrowing.tracking_code}`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-gray-50 p-3 rounded-md text-gray-700 text-sm">
          <h4 className="font-medium mb-1">Suggested Actions:</h4>
          <ul className="space-y-1 ml-5 list-disc">
            {errorType === "borrowing" && (
              <>
                <li>Ensure all books are returned before deleting the student</li>
                <li>Consider deactivating the student instead of deletion</li>
                <li>Check the student's borrowing history for any issues</li>
              </>
            )}
            {errorType === "foreign_key" && (
              <>
                <li>Archive the student record instead of deleting it</li>
                <li>Update the student status to "inactive" or "graduated"</li>
                <li>Contact system administrator if deletion is necessary</li>
              </>
            )}
            {errorType === "general" && (
              <>
                <li>Try the operation again later</li>
                <li>Contact system administrator if the problem persists</li>
              </>
            )}
          </ul>
        </div>

        <DialogFooter className="flex sm:justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          
          {errorType === "borrowing" && studentId && (
            <Button 
              onClick={handleViewBorrowings}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Student Details
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 