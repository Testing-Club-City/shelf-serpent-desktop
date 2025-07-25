import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Download, Users, AlertCircle, CheckCircle, Info, FileSpreadsheet, FileText, GraduationCap } from 'lucide-react';
import { useClasses, useCreateClass } from '@/hooks/useClasses';
import { useOptimizedStudents } from '@/hooks/useOptimizedStudents';
import { useCreateStudent } from '@/hooks/useStudents';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Academic level configurations
const ACADEMIC_LEVELS = {
  form: {
    label: 'Form',
    levels: [
      { value: 1, label: 'Form 1' },
      { value: 2, label: 'Form 2' },
      { value: 3, label: 'Form 3' },
      { value: 4, label: 'Form 4' }
    ]
  },
  grade: {
    label: 'Grade',
    levels: [
      { value: 7, label: 'Grade 7' },
      { value: 8, label: 'Grade 8' },
      { value: 9, label: 'Grade 9' },
      { value: 10, label: 'Grade 10' },
      { value: 11, label: 'Grade 11' },
      { value: 12, label: 'Grade 12' }
    ]
  }
};

export const BulkStudentEntry = () => {
  const [studentData, setStudentData] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: string[]; duplicates: string[] } | null>(null);
  const [inputMethod, setInputMethod] = useState<'text' | 'file'>('text');
  const [academicYear, setAcademicYear] = useState<string>('2024/2025');
  const [showMissingClassesDialog, setShowMissingClassesDialog] = useState(false);
  const [showUploadConfirmDialog, setShowUploadConfirmDialog] = useState(false);
  const [missingClasses, setMissingClasses] = useState<{className: string, formLevel: number, classSection: string, academicType: string}[]>([]);
  const [isCreatingClasses, setIsCreatingClasses] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: classes, refetch: refetchClasses } = useClasses();
  
  // Fetch existing students for duplicate detection
  const { data: existingStudentsData } = useOptimizedStudents(1, 10000);
  const createStudent = useCreateStudent();
  const createClass = useCreateClass();
  const { toast } = useToast();

  // Get all existing admission numbers for duplicate detection
  const existingAdmissionNumbers = new Set(
    existingStudentsData?.students?.map(s => s.admission_number.toLowerCase()) || []
  );

  // Create class name to ID mapping for quick lookup
  const classNameToIdMap = new Map();
  classes?.forEach(cls => {
    classNameToIdMap.set(cls.class_name.toLowerCase(), cls.id);
  });

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
          // Check if we have at least the required fields (admission number, first name, last name, class name)
          if (row.length >= 4 && row[0] && row[1] && row[2] && row[3]) {
            // Check if this looks like a header row
            const firstCell = row[0].toString().toLowerCase();
            if (index === 0 && (firstCell.includes('admission') || firstCell.includes('number') || firstCell.includes('id'))) {
              return; // Skip header row
            }
            
            // Include academic system, form level and section if available
            const academicSystem = row[4] || '';
            const formLevel = row[5] || '';
            const section = row[6] || '';
            
            csvData += `${row[0]},${row[1]},${row[2]},${row[3]},${academicSystem},${formLevel},${section}\n`;
          }
        });
        
        setStudentData(csvData);
        setInputMethod('file');
        
        toast({
          title: 'File Uploaded',
          description: `Successfully loaded ${csvData.split('\n').filter(line => line.trim()).length} students from Excel file`,
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

  const downloadTemplate = () => {
    const template = 'admission_number,first_name,last_name,class_name,academic_system,form_level,section\nSTU001,John,Doe,Form 1A,form,1,A\nSTU002,Jane,Smith,Form 2B,form,2,B\nSTU003,Robert,Brown,Form 3C,form,3,C\nSTU004,Alice,Johnson,Form 4A,form,4,A';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadExcelTemplate = () => {
    // Create sample data with more detailed class information
    const sampleData = [
      ['admission_number', 'first_name', 'last_name', 'class_name', 'academic_system', 'form_level', 'section'],
      ['STU001', 'John', 'Doe', 'Form 1A', 'form', '1', 'A'],
      ['STU002', 'Jane', 'Smith', 'Form 2B', 'form', '2', 'B'],
      ['STU003', 'Robert', 'Brown', 'Form 3C', 'form', '3', 'C'],
      ['STU004', 'Alice', 'Johnson', 'Form 4A', 'form', '4', 'A'],
      ['STU005', 'Michael', 'Wilson', 'Grade 10A', 'grade', '10', 'A'],
      ['STU006', 'Emily', 'Taylor', 'Grade 11B', 'grade', '11', 'B']
    ];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students Template');
    
    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, 'student_import_template.xlsx');
  };

  // Parse class name to extract form level and section
  const parseClassName = (className: string, academicSystem?: string, formLevel?: string, section?: string) => {
    // If detailed information is provided, use it
    if (academicSystem && formLevel) {
      return {
        formLevel: parseInt(formLevel),
        classSection: section || 'A',
        academicType: academicSystem.toLowerCase()
      };
    }
    
    // Otherwise, parse from class name
    let parsedFormLevel = 1;
    let parsedClassSection = 'A';
    let parsedAcademicType = 'form';
    
    const formMatch = className.match(/Form\s*(\d+)\s*([A-Z])?/i);
    const gradeMatch = className.match(/Grade\s*(\d+)\s*([A-Z])?/i);
    
    if (formMatch) {
      parsedFormLevel = parseInt(formMatch[1]);
      parsedClassSection = formMatch[2] || 'A';
      parsedAcademicType = 'form';
    } else if (gradeMatch) {
      parsedFormLevel = parseInt(gradeMatch[1]);
      parsedClassSection = gradeMatch[2] || 'A';
      parsedAcademicType = 'grade';
    }
    
    return { 
      formLevel: parsedFormLevel, 
      classSection: parsedClassSection, 
      academicType: parsedAcademicType 
    };
  };

  const validateAndPrepareBulkUpload = async () => {
    if (!studentData.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter student data',
        variant: 'destructive',
      });
      return;
    }

    const lines = studentData.trim().split('\n');
    const missingClassNames: {className: string, formLevel: number, classSection: string, academicType: string}[] = [];
    
    // Check for missing classes
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 4) continue;

      const className = parts[3];
      const academicSystem = parts[4];
      const formLevel = parts[5];
      const section = parts[6];
      
      if (!className) continue;

      // Check if class exists
      if (!classNameToIdMap.has(className.toLowerCase())) {
        const { formLevel: parsedFormLevel, classSection: parsedClassSection, academicType: parsedAcademicType } = 
          parseClassName(className, academicSystem, formLevel, section);
        
        // Check if this class is already in our missing classes list
        if (!missingClassNames.some(c => c.className.toLowerCase() === className.toLowerCase())) {
          missingClassNames.push({ 
            className, 
            formLevel: parsedFormLevel, 
            classSection: parsedClassSection,
            academicType: parsedAcademicType
          });
        }
      }
    }

    if (missingClassNames.length > 0) {
      setMissingClasses(missingClassNames);
      setShowMissingClassesDialog(true);
    } else {
      handleBulkUpload();
    }
  };

  // Function to create missing classes
  const handleCreateMissingClasses = async () => {
    setIsCreatingClasses(true);
    try {
      for (const classInfo of missingClasses) {
        await createClass.mutateAsync({
          class_name: classInfo.className,
          form_level: classInfo.formLevel,
          class_section: classInfo.classSection,
          max_books_allowed: 3,
          is_active: true,
          academic_level_type: classInfo.academicType
        });
      }
      
      // Refetch classes to update the local data
      await refetchClasses();
      
      // Update class name to ID mapping
      const updatedClasses = await refetchClasses();
      updatedClasses?.data?.forEach(cls => {
        classNameToIdMap.set(cls.class_name.toLowerCase(), cls.id);
      });
      
      toast({
        title: 'Success',
        description: `Created ${missingClasses.length} new classes successfully!`,
      });
      
      setShowMissingClassesDialog(false);
      setMissingClasses([]);
      
      // Show upload confirmation dialog instead of auto-uploading
      setShowUploadConfirmDialog(true);
      
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to create classes: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingClasses(false);
    }
  };

  // Function to handle upload confirmation after creating classes
  const handleUploadConfirmation = () => {
    setShowUploadConfirmDialog(false);
    handleBulkUpload();
  };

  const handleBulkUpload = async () => {
    if (!studentData.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter student data',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setResults(null);

    const lines = studentData.trim().split('\n');
    const errors: string[] = [];
    const duplicates: string[] = [];
    let successCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      try {
        // Expected format: "admission_number,first_name,last_name,class_name,academic_system,form_level,section"
        const parts = line.split(',').map(p => p.trim());
        
        if (parts.length < 4) {
          errors.push(`Line ${i + 1}: Invalid format. Expected at least: admission_number,first_name,last_name,class_name`);
          continue;
        }

        const [admission_number, first_name, last_name, class_name] = parts;

        if (!admission_number || !first_name || !last_name || !class_name) {
          errors.push(`Line ${i + 1}: Missing required fields`);
          continue;
        }

        // Check for duplicates
        if (existingAdmissionNumbers.has(admission_number.toLowerCase())) {
          duplicates.push(`Line ${i + 1}: Student with admission number "${admission_number}" already exists`);
          continue;
        }

        // Get class ID from map
        const classId = classNameToIdMap.get(class_name.toLowerCase());
        
        if (!classId) {
          errors.push(`Line ${i + 1}: Class "${class_name}" not found. Please create it first.`);
          continue;
        }

        await createStudent.mutateAsync({
          admission_number,
          first_name,
          last_name,
          class_grade: class_name,
          class_id: classId,
          status: 'active',
          academic_year: academicYear
        });

        // Add to existing set to prevent duplicates within this batch
        existingAdmissionNumbers.add(admission_number.toLowerCase());
        successCount++;
      } catch (error: any) {
        errors.push(`Line ${i + 1}: ${error.message}`);
      }
    }

    setResults({ success: successCount, errors, duplicates });
    setIsProcessing(false);

    if (successCount > 0) {
      toast({
        title: 'Bulk Upload Complete',
        description: `Successfully added ${successCount} students`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600">Import multiple students at once with automatic class creation</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadTemplate} variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            CSV Template
          </Button>
          <Button onClick={downloadExcelTemplate} variant="outline">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Student Data Entry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Academic Year Input */}
            <div>
              <Label htmlFor="academic-year">Academic Year</Label>
              <Input
                id="academic-year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2024/2025"
              />
            </div>

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
                <Label htmlFor="student-data">Student Data</Label>
                <Textarea
                  id="student-data"
                  placeholder="Enter student data in CSV format:&#10;admission_number,first_name,last_name,class_name,academic_system,form_level,section&#10;&#10;Example:&#10;STU001,John,Doe,Form 1A,form,1,A&#10;STU002,Jane,Smith,Form 2B,form,2,B"
                  value={studentData}
                  onChange={(e) => setStudentData(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Format: admission_number,first_name,last_name,class_name,academic_system,form_level,section (one student per line)
                </p>
              </div>
            )}

            {/* Data Preview for File Upload */}
            {inputMethod === 'file' && studentData && (
              <div>
                <Label>Data Preview</Label>
                <Textarea
                  value={studentData}
                  onChange={(e) => setStudentData(e.target.value)}
                  rows={6}
                  className="font-mono text-sm mt-2"
                  placeholder="Uploaded data will appear here..."
                />
                <p className="text-sm text-gray-500 mt-2">
                  You can edit the data above before processing.
                </p>
              </div>
            )}

            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-500" />
              <AlertDescription className="text-blue-700">
                Classes will be automatically created if they don't exist in the system.
              </AlertDescription>
            </Alert>

            <Button 
              onClick={validateAndPrepareBulkUpload}
              disabled={isProcessing || !studentData.trim()}
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
                  Add Students
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instructions & Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Input Options:</h4>
              <div className="space-y-3">
                <div>
                  <h5 className="font-medium text-blue-800">Text Input Format:</h5>
                  <ul className="text-sm text-blue-800 space-y-1 ml-2">
                    <li>• One student per line</li>
                    <li>• Required: admission_number,first_name,last_name,class_name</li>
                    <li>• Optional: academic_system (form/grade),form_level,section</li>
                    <li>• Example: STU001,John,Doe,Form 1A,form,1,A</li>
                    <li>• Lines starting with # are ignored (comments)</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-blue-800">Excel File Format:</h5>
                  <ul className="text-sm text-blue-800 space-y-1 ml-2">
                    <li>• Required columns: admission_number | first_name | last_name | class_name</li>
                    <li>• Optional columns: academic_system | form_level | section</li>
                    <li>• Headers required (automatically detected)</li>
                    <li>• Supports .xlsx, .xls, and .csv files</li>
                  </ul>
                </div>
                <div className="text-sm text-blue-800">
                  <strong>Note:</strong> Providing academic_system, form_level, and section helps prevent duplicate classes
                </div>
              </div>
            </div>

            {/* Results */}
            {results && (
              <div className="space-y-4">
                {results.success > 0 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span>Successfully added {results.success} students</span>
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog for missing classes */}
      <Dialog open={showMissingClassesDialog} onOpenChange={setShowMissingClassesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Missing Classes Detected
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-4">
              The following classes do not exist in the system yet. Would you like to create them automatically?
            </p>
            <ul className="list-disc list-inside space-y-1 mb-4">
              {missingClasses.map((cls, index) => (
                <li key={index}>{cls.className} (Form Level: {cls.formLevel}, Section: {cls.classSection})</li>
              ))}
            </ul>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Creating these classes will allow you to assign students to them during import.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMissingClassesDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateMissingClasses}
              disabled={isCreatingClasses}
            >
              {isCreatingClasses ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Classes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for upload confirmation */}
      <Dialog open={showUploadConfirmDialog} onOpenChange={setShowUploadConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Classes Created Successfully</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>
              All missing classes have been created. Would you like to proceed with importing students?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUploadConfirmation}>
              Import Students
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
