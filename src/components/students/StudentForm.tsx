import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, AlertCircle } from 'lucide-react';
import { useClassesOffline } from '@/hooks/useClassesOffline';

interface StudentFormProps {
  student?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export const StudentForm = ({ student, onSubmit, onCancel }: StudentFormProps) => {
  const [formData, setFormData] = useState({
    admission_number: student?.admission_number || '',
    first_name: student?.first_name || '',
    last_name: student?.last_name || '',
    academic_system: student?.academic_system || 'Form System',
    form: student?.form || '',
    class_section: student?.class_section || '',
    status: student?.status || 'active'
  });

  const { data: classes = [], isLoading: classesLoading } = useClassesOffline();

  const availableClasses = useMemo(() => {
    if (!classes || classes.length === 0 || !formData.form) return [];
    
    const formLevel = formData.academic_system === 'Grade System' 
      ? parseInt(formData.form.replace('Grade ', ''))
      : parseInt(formData.form.replace('Form ', ''));
    
    const uniqueSections = new Set();
    return (classes as any[])
      .filter((cls: any) => 
        cls.is_active && 
        cls.class_section && 
        cls.form_level === formLevel &&
        !uniqueSections.has(cls.class_section)
      )
      .map((cls: any) => {
        uniqueSections.add(cls.class_section);
        return {
          id: cls.id,
          class_section: cls.class_section
        };
      })
      .sort((a, b) => a.class_section.localeCompare(b.class_section));
  }, [classes, formData.form, formData.academic_system]);

  const isValidClass = useMemo(() => {
    if (!formData.class_section) return true;
    return availableClasses.some(cls => cls.class_section === formData.class_section);
  }, [formData.class_section, availableClasses]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidClass) return;
    
    const selectedClass = (classes as any[]).find((cls: any) => 
      cls.class_section === formData.class_section && 
      cls.form_level === (formData.academic_system === 'Grade System' 
        ? parseInt(formData.form.replace('Grade ', ''))
        : parseInt(formData.form.replace('Form ', '')))
    );
    
    const submitData = {
      admission_number: formData.admission_number,
      first_name: formData.first_name,
      last_name: formData.last_name,
      class_grade: selectedClass?.class_name || `${formData.form} ${formData.class_section}`,
      class_id: selectedClass?.id || null,
      status: formData.status
    };
    onSubmit(submitData);
  };

  return (
    <div className="bg-white rounded-lg max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <h2 className="text-xl font-semibold">Add New Student</h2>
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Row 1 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">
              Admission Number <span className="text-red-500">*</span>
            </Label>
            <Input
              value={formData.admission_number}
              onChange={(e) => setFormData({ ...formData, admission_number: e.target.value })}
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">
              Academic System <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.academic_system} 
              onValueChange={(value) => setFormData({ ...formData, academic_system: value, form: '' })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Form System">Form System</SelectItem>
                <SelectItem value="Grade System">Grade System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">
              {formData.academic_system === 'Grade System' ? 'Grade' : 'Form'} <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.form} 
              onValueChange={(value) => setFormData({ ...formData, form: value, class_section: '' })}
              required
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={formData.academic_system === 'Grade System' ? 'Select Grade' : 'Select Form'} />
              </SelectTrigger>
              <SelectContent>
                {formData.academic_system === 'Grade System' ? (
                  <>
                    <SelectItem value="Grade 8">Grade 8</SelectItem>
                    <SelectItem value="Grade 9">Grade 9</SelectItem>
                    <SelectItem value="Grade 10">Grade 10</SelectItem>
                    <SelectItem value="Grade 11">Grade 11</SelectItem>
                    <SelectItem value="Grade 12">Grade 12</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="Form 1">Form 1</SelectItem>
                    <SelectItem value="Form 2">Form 2</SelectItem>
                    <SelectItem value="Form 3">Form 3</SelectItem>
                    <SelectItem value="Form 4">Form 4</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">
              Class Section <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.class_section}
              onValueChange={(value) => setFormData({ ...formData, class_section: value })}
              required
              disabled={classesLoading}
            >
              <SelectTrigger className={`mt-1 ${!isValidClass ? 'border-red-500' : ''}`}>
                <SelectValue placeholder={classesLoading ? "Loading..." : "Select class section"} />
              </SelectTrigger>
              <SelectContent>
                {availableClasses.length > 0 ? (
                  availableClasses.map((cls, index) => (
                    <SelectItem key={`${cls.class_section}-${index}`} value={cls.class_section}>
                      {cls.class_section}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-classes-available" disabled>
                    {classesLoading ? "Loading..." : "No active classes available"}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {!isValidClass && formData.class_section && (
              <div className="flex items-center gap-2 text-sm text-red-600 mt-1">
                <AlertCircle className="h-4 w-4" />
                Class section does not exist
              </div>
            )}
          </div>
          <div>
            <Label className="text-sm font-medium">
              First Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              className="mt-1"
              required
            />
          </div>
        </div>

        {/* Row 4 */}
        <div>
          <Label className="text-sm font-medium">
            Last Name <span className="text-red-500">*</span>
          </Label>
          <Input
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            className="mt-1"
            required
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!isValidClass || classesLoading || availableClasses.length === 0}
          >
            Add Student
          </Button>
        </div>
      </form>
    </div>
  );
};