import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Printer, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSystemSettings, getSchoolNameFromSettings } from '@/hooks/useSystemSettings';

interface FineCollectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  totalCollectedFines: number;
}

export const FineCollectionDialog: React.FC<FineCollectionDialogProps> = ({
  isOpen,
  onClose,
  totalCollectedFines
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
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div class="title">${schoolName || 'SHELF SCRIBE LIBRARY'}</div>
            <div class="subtitle">Fine Collection Report</div>
          </div>
          
          <div class="divider"></div>
          
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
          
          <div class="info total">
            <span>TOTAL COLLECTED:</span>
            <span>${formatCurrency(totalCollectedFines)}</span>
          </div>
          
          <div class="divider"></div>
          
          <div class="footer">
            <p>Thank you for using ${schoolName || 'Shelf Scribe'} Library Management System</p>
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
      description: "Your fine collection receipt is ready for printing."
    });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Fine Collection Summary</DialogTitle>
          <DialogDescription>
            View the total amount of fines collected in the library system.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-6">
          <div className="bg-blue-50 rounded-lg p-6 text-center">
            <h3 className="text-lg font-medium text-gray-700 mb-2">Total Fines Collected</h3>
            <p className="text-3xl font-bold text-blue-700">{formatCurrency(totalCollectedFines)}</p>
          </div>
          
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Receipt Number</span>
              <span className="font-medium">{receiptNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Generated Date</span>
              <span className="font-medium">{currentDate}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Generated Time</span>
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
            Close
          </Button>
          <Button 
            onClick={handlePrintReceipt}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            disabled={isPrinting}
          >
            {isPrinting ? (
              <>Processing...</>
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4" />
                Print Receipt
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FineCollectionDialog;
