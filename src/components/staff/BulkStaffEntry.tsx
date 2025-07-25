import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, Users, AlertCircle, CheckCircle, Info, FileText, FileSpreadsheet } from 'lucide-react';
import { useCreateStaff } from '@/hooks/useStaff';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

export const BulkStaffEntry = () => {
  const [staffData, setStaffData] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: string[]; duplicates: string[] } | null>(null);
  const [inputMethod, setInputMethod] = useState<'text' | 'file'>('text');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createStaff = useCreateStaff();
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first worksheet
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        // Convert to CSV format
        let csvData = '';
        jsonData.forEach((row, index) => {
          // Skip empty rows and header row if it contains headers
          if (row.length >= 3 && row[0] && row[1] && row[2]) {
            // Check if this looks like a header row
            const firstCell = row[0]?.toString().toLowerCase() || '';
            if (index === 0 && (firstCell.includes('tsc') || firstCell.includes('staff') || firstCell.includes('id'))) {
              return; // Skip header row
            }
            
            // Format: tsc_number,first_name,last_name,email,department,position
            const email = row[3] || '';
            const department = row[4] || '';
            const position = row[5] || '';
            csvData += `${row[0]},${row[1]},${row[2]},${email},${department},${position}\n`;
          }
        });
        
        setStaffData(csvData);
        setInputMethod('file');
        
        toast({
          title: 'File Uploaded',
          description: `Successfully loaded ${csvData.split('\n').filter(line => line.trim()).length} staff members from Excel file`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to read Excel file. Please check the format and try again.',
          variant: 'destructive',
        });
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  const downloadExcelTemplate = () => {
    // Create sample data
    const sampleData = [
      ['tsc_number', 'first_name', 'last_name', 'email', 'department', 'position'],
      ['TSC001', 'John', 'Doe', 'john.doe@school.com', 'Mathematics', 'Teacher'],
      ['TSC002', 'Jane', 'Smith', 'jane.smith@school.com', 'English', 'HOD'],
      ['TSC003', 'Robert', 'Brown', 'robert.brown@school.com', 'Science', 'Teacher'],
      ['TSC004', 'Alice', 'Johnson', 'alice.johnson@school.com', 'History', 'Teacher'],
    ];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Staff Template');
    
    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, 'staff_import_template.xlsx');
  };

  const handleBulkUpload = async () => {
    if (!staffData.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter staff data',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setResults(null);

    const lines = staffData.trim().split('\n');
    const errors: string[] = [];
    const duplicates: string[] = [];
    let successCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      try {
        // Expected format: "tsc_number,first_name,last_name,email,department,position"
        const parts = line.split(',').map(p => p.trim());
        
        if (parts.length < 3) {
          errors.push(`Line ${i + 1}: Invalid format. Expected: tsc_number,first_name,last_name[,email,department,position]`);
          continue;
        }

        const [staff_id, first_name, last_name, email, department, position] = parts;

        if (!staff_id || !first_name || !last_name) {
          errors.push(`Line ${i + 1}: Missing required fields (tsc_number, first_name, last_name)`);
          continue;
        }

        await createStaff.mutateAsync({
          staff_id,
          first_name,
          last_name,
          email: email || undefined,
          department: department || undefined,
          position: position || undefined,
          status: 'active',
        });

        successCount++;
      } catch (error: any) {
        const [staff_id] = line.split(',').map(p => p.trim());
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          duplicates.push(`Line ${i + 1}: Staff with TSC Number "${staff_id}" already exists`);
        } else {
          errors.push(`Line ${i + 1}: ${error.message}`);
        }
      }
    }

    setResults({ success: successCount, errors, duplicates });
    setIsProcessing(false);

    if (successCount > 0) {
      toast({
        title: 'Bulk Upload Complete',
        description: `Successfully added ${successCount} staff members`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600">Import multiple staff members at once</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadExcelTemplate} variant="outline">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel Template
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Staff Data Entry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input Method Selection */}
          <div>
            <Label>Input Method</Label>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant={inputMethod === 'text' ? 'default' : 'outline'}
                onClick={() => setInputMethod('text')}
                className="flex-1"
              >
                <FileText className="w-4 h-4 mr-2" />
                Text Input
              </Button>
              <Button
                type="button"
                variant={inputMethod === 'file' ? 'default' : 'outline'}
                onClick={() => setInputMethod('file')}
                className="flex-1"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel Upload
              </Button>
            </div>
          </div>

          {/* File Upload Section */}
          {inputMethod === 'file' && (
            <div>
              <Label htmlFor="file-upload">Upload Excel File</Label>
              <div className="mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Excel File
                </Button>
                <p className="text-sm text-gray-500 mt-2">
                  Supports .xlsx, .xls, and .csv files. First row can be headers.
                </p>
              </div>
            </div>
          )}

          {/* Text Input Section */}
          {inputMethod === 'text' && (
          <div>
            <Label htmlFor="staff-data">Staff Data</Label>
            <Textarea
              id="staff-data"
                placeholder="Enter staff data in CSV format:&#10;tsc_number,first_name,last_name,email,department,position&#10;&#10;Example:&#10;TSC001,John,Doe,john.doe@school.com,Mathematics,Teacher&#10;TSC002,Jane,Smith,jane.smith@school.com,English,HOD"
              value={staffData}
              onChange={(e) => setStaffData(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-sm text-gray-500 mt-2">
                Format: tsc_number,first_name,last_name[,email,department,position] (one staff per line)
              </p>
            </div>
          )}

          {/* Data Preview for File Upload */}
          {inputMethod === 'file' && staffData && (
            <div>
              <Label>Data Preview</Label>
              <Textarea
                value={staffData}
                onChange={(e) => setStaffData(e.target.value)}
                rows={6}
                className="font-mono text-sm mt-2"
                placeholder="Uploaded data will appear here..."
              />
              <p className="text-sm text-gray-500 mt-2">
                You can edit the data above before processing.
            </p>
          </div>
          )}

          <Button 
            onClick={handleBulkUpload}
            disabled={isProcessing || !staffData.trim()}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" />
                Add Staff Members
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.success > 0 && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>Successfully added {results.success} staff members</span>
              </div>
            )}

            {results.duplicates.length > 0 && (
              <div>
                <h4 className="font-semibold text-yellow-600 mb-2">Duplicates Skipped:</h4>
                <ul className="list-disc list-inside text-sm text-yellow-600 space-y-1">
                  {results.duplicates.map((duplicate, index) => (
                    <li key={index}>{duplicate}</li>
                  ))}
                </ul>
              </div>
            )}

            {results.errors.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Errors:
                </h4>
                <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                  {results.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};