import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api, type BarcodeData, type Book } from '@/lib/tauri-api';
import { Scan, StopCircle, BookOpen, AlertCircle } from 'lucide-react';

interface BarcodeScannerProps {
  onBookFound?: (book: Book) => void;
  onError?: (error: string) => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onBookFound,
  onError
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBarcodeScanned = useCallback(async (data: BarcodeData) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setLastScannedCode(data.code);
    
    try {
      // Look up the book by barcode
      const book = await api.getBookByBarcode(data.code);
      
      if (book) {
        onBookFound?.(book);
        // Auto-stop scanning after successful scan
        await api.stopBarcodeScan();
        setIsScanning(false);
      } else {
        onError?.(`No book found with barcode: ${data.code}`);
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
      onError?.(`Error processing barcode: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, onBookFound, onError]);

  useEffect(() => {
    const setupEventListeners = async () => {
      // Listen for barcode scan events
      const unlistenBarcode = await api.onBarcodeScanned(handleBarcodeScanned);
      
      const unlistenScanStarted = await api.onBarcodeScanStarted(() => {
        setIsScanning(true);
      });
      
      const unlistenScanStopped = await api.onBarcodeScanStopped(() => {
        setIsScanning(false);
      });

      return () => {
        unlistenBarcode();
        unlistenScanStarted();
        unlistenScanStopped();
      };
    };

    setupEventListeners();
  }, [handleBarcodeScanned]);

  const startScanning = async () => {
    try {
      await api.startBarcodeScan();
      setLastScannedCode('');
    } catch (error) {
      console.error('Failed to start scanning:', error);
      onError?.('Failed to start barcode scanner');
    }
  };

  const stopScanning = async () => {
    try {
      await api.stopBarcodeScan();
    } catch (error) {
      console.error('Failed to stop scanning:', error);
      onError?.('Failed to stop barcode scanner');
    }
  };

  const processManualInput = async () => {
    if (!manualInput.trim()) return;
    
    setIsProcessing(true);
    
    try {
      const result = await api.processBarcode(manualInput.trim());
      
      if (result.success && result.data) {
        await handleBarcodeScanned(result.data);
      } else {
        onError?.(result.error || 'Failed to process barcode');
      }
    } catch (error) {
      console.error('Error processing manual input:', error);
      onError?.(`Error processing barcode: ${error}`);
    } finally {
      setIsProcessing(false);
      setManualInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      processManualInput();
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Scan className="w-5 h-5" />
          Barcode Scanner
        </CardTitle>
        <CardDescription>
          Scan or manually enter book barcodes
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Scanner Status */}
        <div className="text-center">
          {isScanning ? (
            <div className="flex items-center justify-center gap-2 text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Scanner Active</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span className="text-sm">Scanner Inactive</span>
            </div>
          )}
        </div>

        {/* Last Scanned Code */}
        {lastScannedCode && (
          <div className="p-3 bg-gray-50 rounded-md">
            <div className="text-xs text-gray-500 mb-1">Last Scanned:</div>
            <div className="font-mono text-sm">{lastScannedCode}</div>
          </div>
        )}

        {/* Scanner Controls */}
        <div className="flex gap-2">
          {!isScanning ? (
            <Button 
              onClick={startScanning} 
              className="flex-1"
              disabled={isProcessing}
            >
              <Scan className="w-4 h-4 mr-2" />
              Start Scanning
            </Button>
          ) : (
            <Button 
              onClick={stopScanning} 
              variant="destructive" 
              className="flex-1"
              disabled={isProcessing}
            >
              <StopCircle className="w-4 h-4 mr-2" />
              Stop Scanning
            </Button>
          )}
        </div>

        {/* Manual Input */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Manual Entry:</div>
          <div className="flex gap-2">
            <Input
              placeholder="Enter barcode manually"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isProcessing}
            />
            <Button 
              onClick={processManualInput}
              disabled={!manualInput.trim() || isProcessing}
              size="sm"
            >
              <BookOpen className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Processing...</span>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <div>
              <div>• Click "Start Scanning" to activate the barcode scanner</div>
              <div>• Use a USB barcode scanner or manual entry</div>
              <div>• Scanner supports ISBN, UPC, EAN, and custom codes</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
