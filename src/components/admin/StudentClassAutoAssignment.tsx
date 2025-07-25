
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle, Users, ArrowRight } from 'lucide-react';
import { useStudents, useUpdateStudent } from '@/hooks/useStudents';
import { useClasses } from '@/hooks/useClasses';
import { useToast } from '@/hooks/use-toast';

export const StudentClassAutoAssignment = () => {
  const { data: studentsResponse, refetch: refetchStudents } = useStudents();
  const { data: classes = [] } = useClasses();
  
  // Extract students array safely
  const students = Array.isArray(studentsResponse?.students) ? studentsResponse.students : [];
  const updateStudent = useUpdateStudent();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    assigned: number;
    notFound: string[];
    errors: string[];
  } | null>(null);

  // Find unassigned students
  const unassignedStudents = students.filter(student => !student.class_id && student.class_grade);

  // Create mapping between class_grade and actual classes
  const getClassMapping = () => {
    const mapping: Record<string, string> = {};
    classes.forEach(cls => {
      // Direct match
      mapping[cls.class_name] = cls.id;
      
      // Also try variations for better matching
      const variations = [
        cls.class_name.toLowerCase(),
        cls.class_name.replace(/\s+/g, ''),
        cls.class_name.replace(/\s+/g, '').toLowerCase()
      ];
      
      variations.forEach(variation => {
        mapping[variation] = cls.id;
      });
    });
    return mapping;
  };

  const handleAutoAssignment = async () => {
    if (unassignedStudents.length === 0) {
      toast({
        title: 'No Action Needed',
        description: 'All students are already assigned to classes',
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    
    const classMapping = getClassMapping();
    const assignmentResults = {
      assigned: 0,
      notFound: [] as string[],
      errors: [] as string[]
    };

    const total = unassignedStudents.length;

    for (let i = 0; i < unassignedStudents.length; i++) {
      const student = unassignedStudents[i];
      const classGrade = student.class_grade.trim();
      
      // Try to find matching class
      let classId = classMapping[classGrade] || 
                   classMapping[classGrade.toLowerCase()] || 
                   classMapping[classGrade.replace(/\s+/g, '')] ||
                   classMapping[classGrade.replace(/\s+/g, '').toLowerCase()];

      if (classId) {
        try {
          await updateStudent.mutateAsync({
            id: student.id,
            class_id: classId
          });
          assignmentResults.assigned++;
        } catch (error) {
          assignmentResults.errors.push(`${student.first_name} ${student.last_name}: ${error.message}`);
        }
      } else {
        assignmentResults.notFound.push(`${student.first_name} ${student.last_name} (${classGrade})`);
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setResults(assignmentResults);
    setIsProcessing(false);
    
    // Refresh data
    await refetchStudents();

    toast({
      title: 'Assignment Complete',
      description: `${assignmentResults.assigned} students assigned successfully`,
    });
  };

  // Preview what will happen
  const getPreview = () => {
    const classMapping = getClassMapping();
    const preview = {
      willAssign: [] as Array<{student: any, className: string}>,
      notFound: [] as Array<{student: any, classGrade: string}>
    };

    unassignedStudents.forEach(student => {
      const classGrade = student.class_grade.trim();
      const classId = classMapping[classGrade] || 
                     classMapping[classGrade.toLowerCase()] || 
                     classMapping[classGrade.replace(/\s+/g, '')] ||
                     classMapping[classGrade.replace(/\s+/g, '').toLowerCase()];

      if (classId) {
        const className = classes.find(c => c.id === classId)?.class_name || 'Unknown';
        preview.willAssign.push({ student, className });
      } else {
        preview.notFound.push({ student, classGrade });
      }
    });

    return preview;
  };

  const preview = getPreview();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Auto-Assign Students to Classes</h3>
        <p className="text-gray-600">
          Automatically assign students to their respective classes based on their class grade information.
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Unassigned Students</p>
                <p className="text-2xl font-bold text-gray-900">{unassignedStudents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Will Be Assigned</p>
                <p className="text-2xl font-bold text-green-600">{preview.willAssign.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertCircle className="w-8 h-8 text-amber-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Class Not Found</p>
                <p className="text-2xl font-bold text-amber-600">{preview.notFound.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Processing Progress */}
      {isProcessing && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Assigning students...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Assignment Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{results.assigned}</p>
                <p className="text-sm text-gray-600">Successfully Assigned</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{results.notFound.length}</p>
                <p className="text-sm text-gray-600">Class Not Found</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{results.errors.length}</p>
                <p className="text-sm text-gray-600">Errors</p>
              </div>
            </div>

            {results.notFound.length > 0 && (
              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <strong>Students with classes not found:</strong>
                  <ul className="mt-2 space-y-1">
                    {results.notFound.slice(0, 5).map((student, index) => (
                      <li key={index} className="text-sm">• {student}</li>
                    ))}
                    {results.notFound.length > 5 && (
                      <li className="text-sm">• ... and {results.notFound.length - 5} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {results.errors.length > 0 && (
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Assignment errors:</strong>
                  <ul className="mt-2 space-y-1">
                    {results.errors.slice(0, 3).map((error, index) => (
                      <li key={index} className="text-sm">• {error}</li>
                    ))}
                    {results.errors.length > 3 && (
                      <li className="text-sm">• ... and {results.errors.length - 3} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview of assignments */}
      {preview.willAssign.length > 0 && !results && (
        <Card>
          <CardHeader>
            <CardTitle>Assignment Preview</CardTitle>
            <CardDescription>
              These students will be assigned to their respective classes:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {preview.willAssign.slice(0, 10).map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm">
                    {item.student.first_name} {item.student.last_name}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.student.class_grade}</Badge>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <Badge>{item.className}</Badge>
                  </div>
                </div>
              ))}
              {preview.willAssign.length > 10 && (
                <p className="text-sm text-gray-500 text-center">
                  ... and {preview.willAssign.length - 10} more students
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleAutoAssignment}
          disabled={isProcessing || unassignedStudents.length === 0}
          className="bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          {isProcessing ? 'Assigning...' : `Auto-Assign ${preview.willAssign.length} Students`}
        </Button>
      </div>

      {unassignedStudents.length === 0 && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <AlertDescription className="text-green-800">
            All students are already assigned to their respective classes!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
