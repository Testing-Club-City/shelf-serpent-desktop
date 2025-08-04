import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Users, BookOpen, GraduationCap, Calendar, Edit2, Trash2 } from 'lucide-react';
import { useClassesOffline, useCreateClassOffline, useUpdateClassOffline, useDeleteClassOffline } from '@/hooks/useClassesOffline';
import { useStudentsOffline } from '@/hooks/useStudentsOffline';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Academic level configurations
const ACADEMIC_LEVELS = {
  form: {
    label: 'Form',
    levels: [
      { value: 1, label: 'Form 1' },
      { value: 2, label: 'Form 2' },
      { value: 3, label: 'Form 3' },
      { value: 4, label: 'Form 4' }
    ],
    progression: {
      '1': '2',
      '2': '3', 
      '3': '4',
      '4': 'graduate'
    }
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
    ],
    progression: {
      '7': '8',
      '8': '9',
      '9': '10',
      '10': '11',
      '11': '12',
      '12': 'graduate'
    }
  }
};

export const ClassManagement = () => {
  // Use offline-first hooks for better performance and offline capability
  const { data: classes = [], isLoading, refetch } = useClassesOffline();
  const { data: students = [] } = useStudentsOffline();
  
  const createClass = useCreateClassOffline();
  const updateClass = useUpdateClassOffline();
  const deleteClass = useDeleteClassOffline();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    class_name: '',
    form_level: 1,
    class_section: 'A',
    max_books_allowed: 3,
    academic_level_type: 'form'
  });

  console.log('All classes:', classes);
  console.log('All students:', students);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const classData = {
        class_name: formData.class_name,
        form_level: formData.form_level,
        class_section: formData.class_section,
        max_books_allowed: parseInt(formData.max_books_allowed.toString()) || 3,
        academic_level_type: formData.academic_level_type,
        is_active: true
      };
      
      console.log('Submitting class data:', classData);
      
      if (isEditMode && editingClassId) {
        await updateClass.mutateAsync({ 
          classId: editingClassId, 
          classData: classData 
        });
        toast({
          title: 'Success',
          description: 'Class updated successfully',
        });
      } else {
        await createClass.mutateAsync(classData);
        toast({
          title: 'Success',
          description: 'Class created successfully',
        });
      }
      
      setIsDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      console.error('Class creation/update error:', error);
      toast({
        title: 'Error',
        description: `Failed to ${isEditMode ? 'update' : 'create'} class: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      class_name: '',
      academic_level_type: 'form',
      form_level: 1,
      class_section: 'A',
      max_books_allowed: 3
    });
    setIsEditMode(false);
    setEditingClassId(null);
  };

  const handleEdit = (classItem: any) => {
    const inferredAcademicType = 
      classItem.form_level >= 1 && classItem.form_level <= 4 ? 'form' : 
      classItem.form_level >= 7 && classItem.form_level <= 12 ? 'grade' : 'form';
    
    setFormData({
      class_name: classItem.class_name,
      academic_level_type: classItem.academic_level_type || inferredAcademicType,
      form_level: classItem.form_level,
      class_section: classItem.class_section || 'A',
      max_books_allowed: classItem.max_books_allowed || 3
    });
    setIsEditMode(true);
    setEditingClassId(classItem.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (classId: string, className: string) => {
    const studentsInClass = getStudentCount(classId);
    
    if (studentsInClass > 0) {
      toast({
        title: 'Cannot Delete Class',
        description: `Cannot delete ${className} because it has ${studentsInClass} students assigned to it.`,
        variant: 'destructive',
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete the class "${className}"? This action cannot be undone.`)) {
      try {
        await deleteClass.mutateAsync(classId);
        refetch();
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete class',
          variant: 'destructive',
        });
      }
    }
  };

  const handleAcademicSystemChange = (systemType: string) => {
    const defaultLevel = systemType === 'form' ? 1 : 7;
    const defaultSection = 'A';
    const defaultClassName = systemType === 'form' 
      ? `Form ${defaultLevel}${defaultSection}` 
      : `Grade ${defaultLevel}${defaultSection}`;
    
    setFormData(prev => ({ 
      ...prev, 
      academic_level_type: systemType,
      form_level: defaultLevel,
      class_section: defaultSection,
      class_name: defaultClassName
    }));
  };

  const handleLevelChange = (levelValue: string) => {
    const levelNumber = parseInt(levelValue);
    const currentSection = formData.class_section || 'A';
    const levelLabel = formData.academic_level_type === 'form' 
      ? `Form ${levelNumber}${currentSection}` 
      : `Grade ${levelNumber}${currentSection}`;
      
    setFormData(prev => ({ 
      ...prev, 
      form_level: levelNumber,
      class_name: levelLabel
    }));
  };

  const handleSectionChange = (sectionValue: string) => {
    const currentLevel = formData.form_level;
    const levelLabel = formData.academic_level_type === 'form' 
      ? `Form ${currentLevel}${sectionValue}` 
      : `Grade ${currentLevel}${sectionValue}`;
      
    setFormData(prev => ({ 
      ...prev, 
      class_section: sectionValue,
      class_name: levelLabel
    }));
  };

  // Remove duplicates first
  const uniqueClasses = classes.reduce((acc, current) => {
    const existingClass = acc.find(cls => (cls as any).class_name === (current as any).class_name);
    if (!existingClass) {
      acc.push(current);
    }
    return acc;
  }, [] as typeof classes);

  const getAllClassesSorted = () => {
    if (!classes || classes.length === 0) return [];
    
    return uniqueClasses.sort((a, b) => {
      // First sort by academic level type
      if ((a as any).academic_level_type !== (b as any).academic_level_type) {
        return (a as any).academic_level_type === 'form' ? -1 : 1;
      }
      // Then by form level
      if ((a as any).form_level !== (b as any).form_level) {
        return (a as any).form_level - (b as any).form_level;
      }
      // Finally by section
      if (!(a as any).class_section && !(b as any).class_section) return 0;
      if (!(a as any).class_section) return -1;
      if (!(b as any).class_section) return 1;
      return (a as any).class_section.localeCompare((b as any).class_section);
    });
  };

  const allClasses = getAllClassesSorted();

  const handleAcademicProgression = async () => {
    if (!window.confirm('Are you sure you want to advance all students to the next academic level? This action cannot be undone.')) {
      return;
    }

    try {
      const studentsWithClasses = students.filter(student => {
        const studentClass = classes.find(cls => cls.id === (student as any).class_id);
        return studentClass ? 
          ((studentClass as any).form_level >= 1 && (studentClass as any).form_level <= 4 ? 'form' : 'grade') : 
          null;
      });

      const progressionUpdates = [];
      const graduations = [];

      for (const student of studentsWithClasses) {
        const currentClass = classes.find(cls => cls.id === (student as any).class_id);
        if (!currentClass) continue;

        const academicType = (currentClass as any).academic_level_type || 
          ((currentClass as any).form_level >= 1 && (currentClass as any).form_level <= 4 ? 'form' : 'grade');
        const currentLevel = (currentClass as any).form_level.toString();
        const nextLevel = ACADEMIC_LEVELS[academicType as keyof typeof ACADEMIC_LEVELS]?.progression[currentLevel];

        if (nextLevel === 'graduate') {
          graduations.push({
            id: student.id,
            is_active: false,
            graduated_at: new Date().toISOString(),
            graduation_level: `${ACADEMIC_LEVELS[academicType as keyof typeof ACADEMIC_LEVELS]?.label} ${currentLevel}`
          });
        } else if (nextLevel) {
          const nextClass = classes.find(cls => {
            const clsAcademicType = (cls as any).academic_level_type || 
              ((cls as any).form_level >= 1 && (cls as any).form_level <= 4 ? 'form' : 'grade');
            
            return clsAcademicType === academicType && 
              (cls as any).form_level.toString() === nextLevel &&
              (cls as any).class_section === (currentClass as any).class_section;
          });

          if (nextClass) {
            progressionUpdates.push({
              id: student.id,
              class_id: nextClass.id
            });
          }
        }
      }

      for (const graduation of graduations) {
        await supabase
          .from('students')
          .update(graduation)
          .eq('id', graduation.id);
      }

      for (const progression of progressionUpdates) {
        await supabase
          .from('students')
          .update({ class_id: progression.class_id })
          .eq('id', progression.id);
      }

      toast({
        title: 'Academic Progression Complete',
        description: `${progressionUpdates.length} students advanced, ${graduations.length} students graduated`,
      });

      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process academic progression',
        variant: 'destructive',
      });
    }
  };

  const getStudentsInClass = (classId: string) => {
    return students.filter(student => (student as any).class_id === classId);
  };

  const getStudentCount = (classId: string) => {
    return getStudentsInClass(classId).length;
  };

  const getActiveStudentCount = (classId: string) => {
    return getStudentsInClass(classId).filter(
      student => (student as any).status === 'active'
    ).length;
  };

  const [viewingClassId, setViewingClassId] = useState<string | null>(null);
  const [isViewingStudents, setIsViewingStudents] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading classes...</div>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleAcademicProgression}
            variant="outline"
            className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
          >
            <GraduationCap className="w-4 h-4 mr-2" />
            Advance Academic Year
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add New Class
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-gray-900">
                  {isEditMode ? 'Edit Class' : 'Create New Class'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="class_name" className="text-sm font-medium text-gray-700">
                    Class Name *
                  </Label>
                  <Input
                    id="class_name"
                    value={formData.class_name}
                    onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                    placeholder="e.g., Grade 10A, Form 4 Science"
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="academic_level_type" className="text-sm font-medium text-gray-700">
                      Academic System
                    </Label>
                    <Select
                      value={formData.academic_level_type}
                      onValueChange={handleAcademicSystemChange}
                    >
                      <SelectTrigger className="border-gray-300 focus:border-blue-500">
                        <SelectValue placeholder="Select system" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="form">Form System</SelectItem>
                        <SelectItem value="grade">Grade System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="form_level" className="text-sm font-medium text-gray-700">
                      {formData.academic_level_type ? 
                        ACADEMIC_LEVELS[formData.academic_level_type as keyof typeof ACADEMIC_LEVELS]?.label : 
                        'Level'
                      }
                    </Label>
                    <Select
                      value={formData.form_level.toString()}
                      onValueChange={handleLevelChange}
                      disabled={!formData.academic_level_type}
                    >
                      <SelectTrigger className="border-gray-300 focus:border-blue-500">
                        <SelectValue placeholder={
                          formData.academic_level_type ? 
                            `Select ${ACADEMIC_LEVELS[formData.academic_level_type as keyof typeof ACADEMIC_LEVELS]?.label}` : 
                            'Select system first'
                        } />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {formData.academic_level_type && 
                          ACADEMIC_LEVELS[formData.academic_level_type as keyof typeof ACADEMIC_LEVELS]?.levels.map((level) => (
                            <SelectItem key={level.value} value={level.value.toString()}>
                              {level.label}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="class_section" className="text-sm font-medium text-gray-700">
                    Section
                  </Label>
                  <Select
                    value={formData.class_section}
                    onValueChange={handleSectionChange}
                  >
                    <SelectTrigger className="border-gray-300 focus:border-blue-500">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="D">D</SelectItem>
                      <SelectItem value="E">E</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                 <div className="space-y-2">
                   <Label htmlFor="max_books_allowed" className="text-sm font-medium text-gray-700">
                     Max Books Allowed
                   </Label>
                   <Input
                     id="max_books_allowed"
                     type="number"
                     min="1"
                     max="10"
                     value={formData.max_books_allowed}
                     onChange={(e) => {
                       const value = e.target.value;
                       if (value === '') {
                         setFormData({ ...formData, max_books_allowed: 1 });
                       } else {
                         const numValue = parseInt(value);
                         if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
                           setFormData({ ...formData, max_books_allowed: numValue });
                         }
                       }
                     }}
                     onBlur={(e) => {
                       // Ensure we have a valid value on blur
                       const value = parseInt(e.target.value);
                       if (isNaN(value) || value < 1) {
                         setFormData({ ...formData, max_books_allowed: 1 });
                       } else if (value > 10) {
                         setFormData({ ...formData, max_books_allowed: 10 });
                       }
                     }}
                     className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                   />
                 </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createClass.isPending || updateClass.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isEditMode ? 'Update Class' : 'Create Class'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <GraduationCap className="w-8 h-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Classes</p>
                <p className="text-2xl font-bold text-gray-900">{allClasses.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-2xl font-bold text-gray-900">
                  {students?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Academic Year</p>
                <p className="text-2xl font-bold text-gray-900">{new Date().getFullYear()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <BookOpen className="w-8 h-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Avg. Book Limit</p>
                <p className="text-2xl font-bold text-gray-900">
                  {allClasses.length > 0 ? Math.round(allClasses.reduce((sum, cls) => sum + ((cls as any).max_books_allowed || 2), 0) / allClasses.length) : 2}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Classes Grid */}
      {allClasses.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <GraduationCap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Yet</h3>
            <p className="text-gray-500 mb-4">Create your first class to start organizing students</p>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add First Class
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allClasses.map((classItem) => {
            const totalStudents = getStudentCount(classItem.id);
            const activeStudents = getActiveStudentCount(classItem.id);
            const academicType = (classItem as any).academic_level_type || 
              ((classItem as any).form_level >= 1 && (classItem as any).form_level <= 4 ? 'form' : 'grade');
            
            return (
              <Card key={classItem.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{(classItem as any).class_name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={activeStudents > 0 ? 'default' : 'secondary'}>
                        {activeStudents} Active
                      </Badge>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(classItem)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(classItem.id, (classItem as any).class_name)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <CardDescription>
                    {academicType === 'form' ? 'Form' : 'Grade'} {(classItem as any).form_level}
                    {(classItem as any).class_section && ` • Section ${(classItem as any).class_section}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Total Students:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{totalStudents}</span>
                        {totalStudents > 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingClassId(classItem.id);
                              setIsViewingStudents(true);
                            }}
                          >
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Active Students:</span>
                      <span className="font-medium text-green-600">{activeStudents}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Max Books Allowed:</span>
                      <span className="font-medium">{(classItem as any).max_books_allowed || 2} books</span>
                    </div>
                    
                    {totalStudents === 0 && (
                      <Alert>
                        <AlertDescription className="text-xs">
                          No students assigned to this class yet.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* View Students Dialog */}
      <Dialog open={isViewingStudents} onOpenChange={setIsViewingStudents}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewingClassId && `Students in ${(classes.find(c => c.id === viewingClassId) as any)?.class_name || 'Selected Class'}`}
            </DialogTitle>
          </DialogHeader>
          {viewingClassId && (
            <div className="space-y-2">
              {getStudentsInClass(viewingClassId).length > 0 ? (
                getStudentsInClass(viewingClassId).map(student => (
                  <div key={student.id} className="p-3 border rounded-lg">
                    <div className="font-medium">{(student as any).first_name} {(student as any).last_name}</div>
                    <div className="text-sm text-gray-500">
                      Admission: {(student as any).admission_number}
                    </div>
                    <div className="text-sm text-gray-500">
                      Status: <span className={(student as any).status === 'active' ? 'text-green-600' : 'text-gray-600'}>
                        {(student as any).status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No students found in this class.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
