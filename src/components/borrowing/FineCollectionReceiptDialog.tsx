import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import { Printer, Check, X, Receipt, User, BookOpen, Calendar, Clock, DollarSign, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSystemSettings, getSchoolNameFromSettings } from '@/hooks/useSystemSettings';
import { getFineTypeDescription } from '@/hooks/useFineManagement';

interface FineCollectionReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  borrowerName: string;
  borrowerType?: 'Student' | 'Staff';
  fineAmount: number;
  fineType: string;
  bookTitle?: string;
  onConfirm: () => void;
}

export const FineCollectionReceiptDialog: React.FC<FineCollectionReceiptDialogProps> = ({
  isOpen,
  onClose,
  borrowerName,
  borrowerType = 'Student',
  fineAmount,
  fineType,
  bookTitle,
  onConfirm
}) => {
  const { toast } = useToast();
  const [isPrinting, setIsPrinting] = useState(false);
  const { data: systemSettings } = useSystemSettings();
  const schoolName = getSchoolNameFromSettings(systemSettings || []);

  // Format the date for the receipt
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Format the time for the receipt
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Generate a receipt number
  const receiptNumber = `FINE-${Date.now().toString().slice(-8)}`;

  // Format the fine type for display
  const formatFineType = (type: string) => {
    return getFineTypeDescription({ fine_type: type });
  };

  const handlePrintReceipt = () => {
    setIsPrinting(true);
    
    // Create a printable receipt window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Failed to open print window",
        description: "Your browser may have blocked the popup. Please check your browser settings.",
        variant: "destructive"
      });
      setIsPrinting(false);
      return;
    }
    
    // HTML content for the receipt
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fine Collection Receipt</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 80mm;
            margin: 0 auto;
            padding: 10px;
          }
          .receipt {
            border: 1px solid #ccc;
            padding: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          .title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .subtitle {
            font-size: 14px;
            margin-bottom: 5px;
          }
          .divider {
            border-top: 1px dashed #ccc;
            margin: 15px 0;
          }
          .info {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            margin-bottom: 5px;
          }
          .total {
            font-weight: bold;
            font-size: 16px;
            margin-top: 10px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 12px;
          }
          .borrower-info {
            font-size: 14px;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div class="title">${schoolName || 'SHELF SCRIBE LIBRARY'}</div>
            <div class="subtitle">Fine Payment Receipt</div>
          </div>
          
          <div class="divider"></div>
          
          <div class="borrower-info">
            <strong>${borrowerType}:</strong> ${borrowerName}
          </div>
          
          <div class="info">
            <span>Receipt #:</span>
            <span>${receiptNumber}</span>
          </div>
          <div class="info">
            <span>Date:</span>
            <span>${currentDate}</span>
          </div>
          <div class="info">
            <span>Time:</span>
            <span>${currentTime}</span>
          </div>
          
          <div class="divider"></div>
          
          <div class="info">
            <span>Fine Type:</span>
            <span>${formatFineType(fineType)}</span>
          </div>
          ${bookTitle ? `
          <div class="info">
            <span>Book:</span>
            <span>${bookTitle}</span>
          </div>
          ` : ''}
          
          <div class="divider"></div>
          
          <div class="info total">
            <span>AMOUNT PAID:</span>
            <span>${formatCurrency(fineAmount)}</span>
          </div>
          
          <div class="divider"></div>
          
          <div class="footer">
            <p>Thank you for paying your fine.</p>
            <p>${schoolName || 'Shelf Scribe'} Library Management System</p>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;
    
    // Write to the new window
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    
    // Listen for the print window to close
    const printCheckInterval = setInterval(() => {
      if (printWindow.closed) {
        clearInterval(printCheckInterval);
        setIsPrinting(false);
      }
    }, 500);
    
    toast({
      title: "Receipt generated",
      description: "Your fine payment receipt is ready for printing."
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Receipt className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900">Fine Collection Receipt</DialogTitle>
              <DialogDescription className="text-gray-600">
                Professional receipt for fine payment collection
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="py-6">
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">{borrowerType} Name:</span>
                <span className="font-medium">{borrowerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fine Type:</span>
                <span className="font-medium">{formatFineType(fineType)}</span>
              </div>
              {bookTitle && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Book:</span>
                  <span className="font-medium">{bookTitle}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Amount:</span>
                <span className="text-blue-700">{formatCurrency(fineAmount)}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Receipt Number</span>
              <span className="font-medium">{receiptNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Date</span>
              <span className="font-medium">{currentDate}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Time</span>
              <span className="font-medium">{currentTime}</span>
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button 
            onClick={handlePrintReceipt}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            disabled={isPrinting}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>
          <Button 
            onClick={() => {
              onConfirm();
              toast({
                title: "Fine Collected",
                description: `Successfully collected ${formatCurrency(fineAmount)} fine payment.`
              });
            }}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
          >
            <Check className="mr-2 h-4 w-4" />
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FineCollectionReceiptDialog;
