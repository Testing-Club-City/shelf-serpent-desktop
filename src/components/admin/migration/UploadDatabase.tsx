import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileUp, CheckCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface UploadDatabaseProps {
  onFileUploaded: (file: File, db?: any) => void;
}

// Initialize SQL.js with proper error handling
const initSqlJs = async () => {
  try {
    console.log('Initializing SQL.js for Kisii School database...');
    
    // Load SQL.js directly from CDN to avoid module loading issues
    if (!(window as any).initSqlJs) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
      document.head.appendChild(script);
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load SQL.js library'));
        setTimeout(() => reject(new Error('SQL.js loading timeout')), 10000);
      });
    }
    
    // Initialize with CDN WASM file
    const SqlJs = await (window as any).initSqlJs({
      locateFile: (file: string) => {
        console.log(`Loading SQL.js file: ${file}`);
        return `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`;
      }
    });
    
    console.log('SQL.js initialized successfully for Kisii School database');
    return SqlJs;
  } catch (error) {
    console.error('Failed to initialize SQL.js:', error);
    throw new Error(`Failed to initialize database engine: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const UploadDatabase = ({ onFileUploaded }: UploadDatabaseProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isValidFile, setIsValidFile] = useState(false);
  const [sqliteDb, setSqliteDb] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Check if it's a SQLite database file
      if (!selectedFile.name.endsWith('.db') && !selectedFile.name.endsWith('.sqlite')) {
        setError('Please select a valid SQLite database file (.db or .sqlite)');
        setFile(null);
        return;
      }
      
      setFile(selectedFile);
      
      // Simulate validating the file structure
      setIsUploading(true);
      
      try {
        setUploadProgress(10);
        
        // Step 1: Validate file header
        const isValidHeader = await validateSQLiteFile(selectedFile);
        if (!isValidHeader) {
          setError('The selected file is not a valid SQLite database.');
          setFile(null);
          return;
        }
        setUploadProgress(30);
        
        // Step 2: Initialize SQL.js
        const SQL = await initSqlJs();
        setUploadProgress(50);
        
        // Step 3: Load the database
        const arrayBuffer = await selectedFile.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        setUploadProgress(70);
        
        // Step 4: Create database instance
        const db = new SQL.Database(uint8Array);
        setUploadProgress(85);
        
        // Step 5: Validate database structure (check for tables)
        const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
        const tables = tablesResult[0]?.values.map((row: any) => String(row[0])) || [];
        
        if (tables.length === 0) {
          setError('The database file appears to be empty or corrupted.');
          setFile(null);
          return;
        }
        
        console.log(`Database loaded successfully with ${tables.length} tables:`, tables);
        setUploadProgress(100);
        
        // Store the database instance
        setSqliteDb(db);
        setIsValidFile(true);
        
      } catch (err) {
        console.error('Error validating/loading database:', err);
        setError('Error processing database file: ' + (err instanceof Error ? err.message : String(err)));
        setFile(null);
        setSqliteDb(null);
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    }
  };

  const validateSQLiteFile = async (file: File): Promise<boolean> => {
    // In a real implementation, we would check for the expected tables
    // For now, we'll just check if it's a binary file with the SQLite header
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (!e.target || !e.target.result) {
          resolve(false);
          return;
        }
        
        // Check for SQLite header "SQLite format 3"
        const header = new Uint8Array(e.target.result as ArrayBuffer).slice(0, 16);
        const sqliteHeader = [0x53, 0x51, 0x4C, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6F, 0x72, 0x6D, 0x61, 0x74, 0x20, 0x33, 0x00];
        
        // Simple check for SQLite header
        const isValidHeader = sqliteHeader.every((byte, i) => byte === header[i]);
        resolve(isValidHeader);
      };
      reader.onerror = () => resolve(false);
      reader.readAsArrayBuffer(file.slice(0, 16));
    });
  };

  const handleUpload = () => {
    if (file && sqliteDb) {
      onFileUploaded(file, sqliteDb);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const fileInput = fileInputRef.current;
      if (fileInput) {
        // Create a DataTransfer object and add the dropped file
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(e.dataTransfer.files[0]);
        
        // Set the files property of the file input
        fileInput.files = dataTransfer.files;
        
        // Trigger the change event manually
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div 
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
          ${file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-primary/50'}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".db,.sqlite"
          className="hidden"
        />
        
        {!file && !isUploading && (
          <div className="flex flex-col items-center justify-center">
            <FileUp className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-1">Upload Database File</h3>
            <p className="text-sm text-gray-500 mb-2">
              Drag and drop your SQLite database file here, or click to browse
            </p>
            <p className="text-xs text-gray-400">
              Supports .db and .sqlite files
            </p>
          </div>
        )}
        
        {isUploading && (
          <div className="flex flex-col items-center justify-center">
            <h3 className="text-lg font-medium mb-4">Validating file...</h3>
            <Progress value={uploadProgress} className="w-full max-w-xs mb-2" />
            <p className="text-sm text-gray-500">
              Please wait while we validate your database file
            </p>
          </div>
        )}
        
        {file && !isUploading && (
          <div className="flex flex-col items-center justify-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-medium mb-1">File Ready</h3>
            <p className="text-sm text-gray-700 mb-2">
              {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
            </p>
            <p className="text-xs text-gray-500">
              Click "Continue" below to proceed with migration settings
            </p>
          </div>
        )}
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {isValidFile && file && (
        <div className="flex justify-end">
          <Button onClick={handleUpload} className="px-6">
            Continue
          </Button>
        </div>
      )}
    </div>
  );
};

export default UploadDatabase; 