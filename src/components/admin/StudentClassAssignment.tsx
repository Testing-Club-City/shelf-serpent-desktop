
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Search, UserPlus, CheckCircle, AlertCircle } from 'lucide-react';
import { useStudents, useUpdateStudent } from '@/hooks/useStudents';
import { useClasses } from '@/hooks/useClasses';
import { useToast } from '@/hooks/use-toast';

export const StudentClassAssignment = () => {
  const { data: studentsResponse, isLoading: studentsLoading } = useStudents();
  const { data: classes = [], isLoading: classesLoading } = useClasses();
  
  // Extract students array safely
  const students = Array.isArray(studentsResponse?.students) ? studentsResponse.students : [];
  const updateStudent = useUpdateStudent();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [bulkAssignClass, setBulkAssignClass] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Get unassigned students
  const unassignedStudents = students.filter(student => !student.class_id);
  
  // Filter students based on search term
  const filteredStudents = unassignedStudents.filter(student =>
    `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.admission_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.class_grade.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter by selected class if provided
  const displayStudents = selectedClass
    ? filteredStudents.filter(student => 
        student.class_grade.toLowerCase().includes(selectedClass.toLowerCase())
      )
    : filteredStudents;

  const handleSingleAssignment = async (studentId: string, classId: string) => {
    try {
      const selectedClassData = classes.find(c => c.id === classId);
      await updateStudent.mutateAsync({
        id: studentId,
        class_id: classId,
        class_grade: selectedClassData?.class_name || ''
      });
      toast({
        title: 'Success',
        description: 'Student assigned to class successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign student to class',
        variant: 'destructive',
      });
    }
  };

  const handleBulkAssignment = async () => {
    if (!bulkAssignClass || selectedStudents.length === 0) return;

    try {
      const selectedClassData = classes.find(c => c.id === bulkAssignClass);
      
      for (const studentId of selectedStudents) {
        await updateStudent.mutateAsync({
          id: studentId,
          class_id: bulkAssignClass,
          class_grade: selectedClassData?.class_name || ''
        });
      }

      toast({
        title: 'Success',
        description: `${selectedStudents.length} students assigned to class successfully`,
      });

      setSelectedStudents([]);
      setBulkAssignClass('');
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign students to class',
        variant: 'destructive',
      });
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  if (studentsLoading || classesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading student and class data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Student Class Assignment</h2>
          <p className="text-gray-600">Assign unassigned students to their respective classes</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Users className="w-4 h-4 mr-2" />
            {unassignedStudents.length} Unassigned
          </Badge>
          {selectedStudents.length > 0 && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Bulk Assign ({selectedStudents.length})
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Assign Students to Class</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Select Class</Label>
                    <Select value={bulkAssignClass} onValueChange={setBulkAssignClass}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.class_name} (Form {cls.form_level})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleBulkAssignment}
                      disabled={!bulkAssignClass}
                    >
                      Assign {selectedStudents.length} Students
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search & Filter Students
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="search">Search Students</Label>
              <Input
                id="search"
                placeholder="Search by name, admission number, or current grade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="filter-class">Filter by Current Grade</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="All grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All grades</SelectItem>
                  {Array.from(new Set(unassignedStudents.map(s => s.class_grade))).map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unassigned Students Alert */}
      {unassignedStudents.length > 0 ? (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>{unassignedStudents.length}</strong> students are not assigned to any class. 
            Please assign them to ensure proper library access controls.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <AlertDescription className="text-green-800">
            All students are properly assigned to classes!
          </AlertDescription>
        </Alert>
      )}

      {/* Students List */}
      {displayStudents.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {unassignedStudents.length === 0 ? 'All Students Assigned!' : 'No Students Found'}
            </h3>
            <p className="text-gray-500">
              {unassignedStudents.length === 0 
                ? 'All students have been assigned to their respective classes.'
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayStudents.map((student) => (
            <Card key={student.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => toggleStudentSelection(student.id)}
                      className="rounded border-gray-300"
                    />
                    <div>
                      <CardTitle className="text-base">
                        {student.first_name} {student.last_name}
                      </CardTitle>
                      <CardDescription>
                        Admission: {student.admission_number}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Current Grade:</span>
                    <Badge variant="outline">{student.class_grade}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Status:</span>
                    <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
                      {student.status}
                    </Badge>
                  </div>
                  
                  <div className="pt-2">
                    <Label className="text-xs">Assign to Class:</Label>
                    <Select 
                      onValueChange={(value) => handleSingleAssignment(student.id, value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Choose class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.class_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
