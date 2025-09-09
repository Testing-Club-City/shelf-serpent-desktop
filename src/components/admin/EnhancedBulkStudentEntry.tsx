import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download, Users, AlertCircle, CheckCircle, FileSpreadsheet, Copy } from 'lucide-react';
import { useClasses } from '@/hooks/useClasses';
import { useOptimizedStudents } from '@/hooks/useOptimizedStudents';
import { useCreateStudent } from '@/hooks/useStudents';
import { useToast } from '@/hooks/use-toast';

export const EnhancedBulkStudentEntry = () => {
  const [selectedForm, setSelectedForm] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [studentData, setStudentData] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: string[]; duplicates: string[] } | null>(null);
  const [academicYear, setAcademicYear] = useState<string>('2024/2025');
  const [bulkClass, setBulkClass] = useState<string>('');

  const { data: classes } = useClasses();
  const { data: existingStudentsData } = useOptimizedStudents(1, 10000); // Get all students for duplicate check
  const createStudent = useCreateStudent();
  const { toast } = useToast();

  // Get unique form levels
  const formLevels = [...new Set(classes?.map(c => c.form_level))].sort();
  
  // Filter classes by selected form level
  const filteredClasses = classes?.filter(c => c.form_level === parseInt(selectedForm)) || [];

  // Get all existing admission numbers for duplicate detection
  const existingAdmissionNumbers = new Set(
    existingStudentsData?.students?.map(s => s.admission_number.toLowerCase()) || []
  );

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      if (file.name.endsWith('.csv')) {
        // Parse CSV content
        const lines = content.split('\n').filter(line => line.trim());
        const csvData = lines.slice(1).map(line => {
          const [admissionNo, firstName, lastName] = line.split(',').map(s => s.trim());
          return `${admissionNo},${firstName},${lastName}`;
        }).join('\n');
        setStudentData(csvData);
      } else {
        // Assume text format
        setStudentData(content);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkUpload = async () => {
    if (!selectedClass || !studentData.trim()) {
      toast({
        title: 'Error',
        description: 'Please select a class and enter student data',
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

    const selectedClassData = classes?.find(c => c.id === selectedClass);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      try {
        // Expected format: "admission_number,first_name,last_name"
        const parts = line.split(',').map(p => p.trim());
        
        if (parts.length < 3) {
          errors.push(`Line ${i + 1}: Invalid format. Expected: admission_number,first_name,last_name`);
          continue;
        }

        const [admission_number, first_name, last_name] = parts;

        if (!admission_number || !first_name || !last_name) {
          errors.push(`Line ${i + 1}: Missing required fields`);
          continue;
        }

        // Check for duplicates
        if (existingAdmissionNumbers.has(admission_number.toLowerCase())) {
          duplicates.push(`Line ${i + 1}: Student with admission number "${admission_number}" already exists`);
          continue;
        }

        await createStudent.mutateAsync({
          admission_number,
          first_name,
          last_name,
          class_grade: selectedClassData?.class_name || `Form ${selectedClassData?.form_level}${selectedClassData?.class_section}`,
          class_id: selectedClass,
          status: 'active',
          academic_year: academicYear,
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

  const handleBulkUploadForClass = async () => {
    if (!bulkClass) {
      toast({
        title: 'Error',
        description: 'Please select a class',
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

    const selectedClassData = classes?.find(c => c.id === bulkClass);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      try {
        const parts = line.split(',').map(p => p.trim());
        
        if (parts.length < 3) {
          errors.push(`Line ${i + 1}: Invalid format. Expected: admission_number,first_name,last_name`);
          continue;
        }

        const [admission_number, first_name, last_name] = parts;

        if (!admission_number || !first_name || !last_name) {
          errors.push(`Line ${i + 1}: Missing required fields`);
          continue;
        }

        if (existingAdmissionNumbers.has(admission_number.toLowerCase())) {
          duplicates.push(`Line ${i + 1}: Student with admission number "${admission_number}" already exists`);
          continue;
        }

        await createStudent.mutateAsync({
          admission_number,
          first_name,
          last_name,
          class_grade: selectedClassData?.class_name || `Form ${selectedClassData?.form_level}${selectedClassData?.class_section}`,
          class_id: bulkClass,
          status: 'active',
          academic_year: academicYear,
        });

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

  const downloadTemplate = () => {
    const template = `# Bulk Student Entry Template - CSV Format
# Format: admission_number,first_name,last_name
# Example:
STU001,John,Doe
STU002,Jane,Smith
STU003,Mike,Johnson
STU004,Sarah,Wilson
STU005,David,Brown`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_bulk_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadExcelTemplate = () => {
    const excelData = `admission_number,first_name,last_name
STU001,John,Doe
STU002,Jane,Smith
STU003,Mike,Johnson
STU004,Sarah,Wilson
STU005,David,Brown`;

    const blob = new Blob([excelData], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_bulk_template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enhanced Bulk Student Entry</h1>
          <p className="text-gray-600">Import multiple students efficiently with duplicate detection</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadTemplate} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            CSV Template
          </Button>
          <Button onClick={downloadExcelTemplate} variant="outline">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel Template
          </Button>
        </div>
      </div>

      <Tabs defaultValue="class-specific" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="class-specific">By Form & Section</TabsTrigger>
          <TabsTrigger value="any-class">Any Class</TabsTrigger>
        </TabsList>

        <TabsContent value="class-specific" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Form & Section Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="form-level">Form Level</Label>
                    <Select value={selectedForm} onValueChange={(value) => {
                      setSelectedForm(value);
                      setSelectedClass('');
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select form level" />
                      </SelectTrigger>
                      <SelectContent>
                        {formLevels.map((level) => (
                          <SelectItem key={level} value={level.toString()}>
                            Form {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="class">Class Section</Label>
                    <Select 
                      value={selectedClass} 
                      onValueChange={setSelectedClass}
                      disabled={!selectedForm}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class section" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredClasses.map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.class_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="academic-year">Academic Year</Label>
                  <Input
                    id="academic-year"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="2024/2025"
                  />
                </div>

                <div>
                  <Label htmlFor="file-upload">Upload CSV/Excel File</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xlsx,.xls,.txt"
                    onChange={handleFileUpload}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="student-data">Student Data</Label>
                  <Textarea
                    id="student-data"
                    placeholder="Enter student data in CSV format:&#10;admission_number,first_name,last_name&#10;&#10;Example:&#10;STU001,John,Doe&#10;STU002,Jane,Smith"
                    value={studentData}
                    onChange={(e) => setStudentData(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>

                <Button 
                  onClick={handleBulkUpload}
                  disabled={isProcessing || !selectedClass || !studentData.trim()}
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
                      Upload Students
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
                  <h4 className="font-medium text-blue-900 mb-2">Format Requirements:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• One student per line</li>
                    <li>• Format: admission_number,first_name,last_name</li>
                    <li>• No spaces around commas</li>
                    <li>• Lines starting with # are ignored (comments)</li>
                    <li>• Duplicate admission numbers are automatically detected</li>
                  </ul>
                </div>

                {results && (
                  <div className="space-y-3">
                    {results.success > 0 && (
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-green-800">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium">
                            Successfully added {results.success} students
                          </span>
                        </div>
                      </div>
                    )}

                    {results.duplicates.length > 0 && (
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-yellow-800 mb-2">
                          <Copy className="w-5 h-5" />
                          <span className="font-medium">
                            {results.duplicates.length} duplicates detected:
                          </span>
                        </div>
                        <div className="max-h-32 overflow-y-auto">
                          {results.duplicates.map((duplicate, index) => (
                            <div key={index} className="text-sm text-yellow-700">
                              {duplicate}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {results.errors.length > 0 && (
                      <div className="bg-red-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-red-800 mb-2">
                          <AlertCircle className="w-5 h-5" />
                          <span className="font-medium">
                            {results.errors.length} errors occurred:
                          </span>
                        </div>
                        <div className="max-h-32 overflow-y-auto">
                          {results.errors.map((error, index) => (
                            <div key={index} className="text-sm text-red-700">
                              {error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Tips:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Download the template for the correct format</li>
                    <li>• Test with a small batch first</li>
                    <li>• Admission numbers must be unique</li>
                    <li>• Students will be assigned to the selected class</li>
                    <li>• Duplicates are automatically detected and skipped</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="any-class" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Upload to Any Class</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bulk-class">Select Class</Label>
                  <Select value={bulkClass} onValueChange={setBulkClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select any class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes?.map((classItem) => (
                        <SelectItem key={classItem.id} value={classItem.id}>
                          {classItem.class_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="academic-year-bulk">Academic Year</Label>
                  <Input
                    id="academic-year-bulk"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="2024/2025"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="student-data-bulk">Student Data</Label>
                <Textarea
                  id="student-data-bulk"
                  placeholder="Enter student data for the selected class..."
                  value={studentData}
                  onChange={(e) => setStudentData(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>

              <Button 
                onClick={handleBulkUploadForClass}
                disabled={isProcessing || !bulkClass || !studentData.trim()}
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
                    Upload to Class
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Results Display */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.success > 0 && (
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">
                    Successfully added {results.success} students
                  </span>
                </div>
              </div>
            )}

            {results.duplicates.length > 0 && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 mb-2">
                  <Copy className="w-5 h-5" />
                  <span className="font-medium">
                    {results.duplicates.length} duplicates detected:
                  </span>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {results.duplicates.map((duplicate, index) => (
                    <div key={index} className="text-sm text-yellow-700">
                      {duplicate}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.errors.length > 0 && (
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-red-800 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">
                    {results.errors.length} errors occurred:
                  </span>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {results.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-700">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
