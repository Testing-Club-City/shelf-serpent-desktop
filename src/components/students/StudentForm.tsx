import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClasses } from '@/hooks/useClasses';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface StudentFormProps {
  student?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

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

export const StudentForm = ({ student, onSubmit, onCancel }: StudentFormProps) => {
  const [selectedAcademicType, setSelectedAcademicType] = useState('form');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [formData, setFormData] = useState({
    admission_number: student?.admission_number || '',
    first_name: student?.first_name || '',
    last_name: student?.last_name || '',
    class_grade: student?.class_grade || '',
    status: student?.status || 'active'
  });

  const { data: classes, isLoading: classesLoading } = useClasses();
  
  // Filter classes by selected academic type and level
  const filteredClasses = classes?.filter(c => {
    const academicType = c.academic_level_type || 
      (c.form_level >= 1 && c.form_level <= 4 ? 'form' : 'grade');
    return academicType === selectedAcademicType && 
           c.form_level === parseInt(selectedLevel);
  }) || [];

  // Initialize form and class selection for editing
  useEffect(() => {
    if (student && classes?.length) {
      const studentClass = classes.find(c => c.id === student.class_id);
      if (studentClass) {
        const academicType = studentClass.academic_level_type || 
          (studentClass.form_level >= 1 && studentClass.form_level <= 4 ? 'form' : 'grade');
        setSelectedAcademicType(academicType);
        setSelectedLevel(studentClass.form_level.toString());
        setSelectedClass(studentClass.id);
      }
    }
  }, [student, classes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedClassData = classes?.find(c => c.id === selectedClass);
    
    const submitData = {
      ...formData,
      class_id: selectedClass,
      class_grade: selectedClassData?.class_name || formData.class_grade,
    };
    
    onSubmit(submitData);
  };

  const handleAcademicTypeChange = (value: string) => {
    setSelectedAcademicType(value);
    setSelectedLevel('');
    setSelectedClass('');
  };

  const handleLevelChange = (value: string) => {
    setSelectedLevel(value);
    setSelectedClass('');
  };

  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    const selectedClassData = classes?.find(c => c.id === value);
    if (selectedClassData) {
      setFormData(prev => ({
        ...prev,
        class_grade: selectedClassData.class_name
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {classesLoading ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Loading class information...</AlertDescription>
        </Alert>
      ) : classes?.length === 0 ? (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            No classes available. Please add classes first before adding students.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="admission_number">Admission Number *</Label>
          <Input
            id="admission_number"
            value={formData.admission_number}
            onChange={(e) => setFormData({ ...formData, admission_number: e.target.value })}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="academic-type">Academic System *</Label>
          <Select 
            value={selectedAcademicType} 
            onValueChange={handleAcademicTypeChange} 
            required
            disabled={classesLoading || classes?.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select academic system" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="form">Form System</SelectItem>
              <SelectItem value="grade">Grade System</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="level">
            {selectedAcademicType ? ACADEMIC_LEVELS[selectedAcademicType as keyof typeof ACADEMIC_LEVELS]?.label : 'Level'} *
          </Label>
          <Select 
            value={selectedLevel} 
            onValueChange={handleLevelChange} 
            required
            disabled={!selectedAcademicType || classesLoading || classes?.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                selectedAcademicType ? 
                  `Select ${ACADEMIC_LEVELS[selectedAcademicType as keyof typeof ACADEMIC_LEVELS]?.label}` : 
                  'Select system first'
              } />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {selectedAcademicType && 
                ACADEMIC_LEVELS[selectedAcademicType as keyof typeof ACADEMIC_LEVELS]?.levels.map((level) => (
                  <SelectItem key={level.value} value={level.value.toString()}>
                    {level.label}
                  </SelectItem>
                ))
              }
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="class">Class Section *</Label>
          <Select 
            value={selectedClass} 
            onValueChange={handleClassChange}
            disabled={!selectedLevel || filteredClasses.length === 0}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select class section" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {filteredClasses.map((classItem) => (
                <SelectItem key={classItem.id} value={classItem.id}>
                  {classItem.class_name}
                </SelectItem>
              ))}
              {selectedLevel && filteredClasses.length === 0 && (
                <div className="p-2 text-sm text-gray-500">No classes available for this level</div>
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="first_name">First Name *</Label>
          <Input
            id="first_name"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="last_name">Last Name *</Label>
          <Input
            id="last_name"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          type="submit"
          disabled={classesLoading || classes?.length === 0 || !selectedClass}
        >
          {student ? 'Update Student' : 'Add Student'}
        </Button>
      </div>
    </form>
  );
};