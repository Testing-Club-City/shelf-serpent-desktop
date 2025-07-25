
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, CalendarDays, Plus, BookOpen, Users, AlertCircle, CheckCircle, ArrowUp } from 'lucide-react';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

interface SchoolTerm {
  id: string;
  term_name: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

interface TermFormData {
  term_name: string;
  academic_year: string;
  start_date: Date | null;
  end_date: Date | null;
}

export const SchoolCalendarManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPromotionDialogOpen, setIsPromotionDialogOpen] = useState(false);
  const [promotionYear, setPromotionYear] = useState('');
  const [formData, setFormData] = useState<TermFormData>({
    term_name: '',
    academic_year: new Date().getFullYear().toString(),
    start_date: null,
    end_date: null
  });

  // Fetch school terms
  const { data: schoolTerms = [], isLoading } = useQuery({
    queryKey: ['school-terms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_terms')
        .select('*')
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      return data as SchoolTerm[];
    }
  });

  // Fetch student statistics
  const { data: studentStats } = useQuery({
    queryKey: ['student-stats'],
    queryFn: async () => {
      const { data: students } = await supabase
        .from('students')
        .select('class_grade, status, academic_year');
      
      if (!students) return { total: 0, byGrade: {}, byYear: {} };
      
      const byGrade = students.reduce((acc, student) => {
        acc[student.class_grade] = (acc[student.class_grade] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const byYear = students.reduce((acc, student) => {
        acc[student.academic_year] = (acc[student.academic_year] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return { total: students.length, byGrade, byYear };
    }
  });

  // Create term mutation
  const createTermMutation = useMutation({
    mutationFn: async (termData: Omit<SchoolTerm, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('school_terms')
        .insert(termData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-terms'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'School term created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create term: ${error.message}`,
        variant: 'destructive',
      });
    }
  });

  // Set current term mutation
  const setCurrentTermMutation = useMutation({
    mutationFn: async (termId: string) => {
      // First, set all terms to not current
      await supabase
        .from('school_terms')
        .update({ is_current: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Then set the selected term as current
      const { error } = await supabase
        .from('school_terms')
        .update({ is_current: true })
        .eq('id', termId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-terms'] });
      toast({
        title: 'Success',
        description: 'Current term updated successfully',
      });
    }
  });

  // Student promotion mutation
  const promoteStudentsMutation = useMutation({
    mutationFn: async (academicYear: string) => {
      // Get all active students
      const { data: students, error: fetchError } = await supabase
        .from('students')
        .select('id, class_grade, academic_year')
        .eq('status', 'active');
      
      if (fetchError) throw fetchError;
      if (!students) return { promoted: 0, graduated: 0 };
      
      let promoted = 0;
      let graduated = 0;
      
      for (const student of students) {
        const currentGrade = student.class_grade.toLowerCase();
        let newGrade = '';
        let newStatus = 'active';
        
        // Define promotion logic for Kenyan education system
        if (currentGrade.includes('form 1') || currentGrade.includes('grade 9')) {
          newGrade = currentGrade.replace(/form 1|grade 9/i, 'Form 2');
        } else if (currentGrade.includes('form 2') || currentGrade.includes('grade 10')) {
          newGrade = currentGrade.replace(/form 2|grade 10/i, 'Form 3');
        } else if (currentGrade.includes('form 3') || currentGrade.includes('grade 11')) {
          newGrade = currentGrade.replace(/form 3|grade 11/i, 'Form 4');
        } else if (currentGrade.includes('form 4') || currentGrade.includes('grade 12')) {
          // Graduating students
          newGrade = 'Graduated';
          newStatus = 'graduated';
          graduated++;
        } else {
          // Handle other grade formats
          const gradeMatch = currentGrade.match(/(\d+)/);
          if (gradeMatch) {
            const gradeNum = parseInt(gradeMatch[1]);
            if (gradeNum < 4) {
              newGrade = currentGrade.replace(/\d+/, (gradeNum + 1).toString());
            } else {
              newGrade = 'Graduated';
              newStatus = 'graduated';
              graduated++;
            }
          } else {
            continue; // Skip if we can't parse the grade
          }
        }
        
        if (newStatus === 'active') promoted++;
        
        // Update student
        await supabase
          .from('students')
          .update({
            class_grade: newGrade,
            academic_year: academicYear,
            status: newStatus
          })
          .eq('id', student.id);
      }
      
      return { promoted, graduated };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setIsPromotionDialogOpen(false);
      setPromotionYear('');
      toast({
        title: 'Student Promotion Complete',
        description: `${result.promoted} students promoted, ${result.graduated} students graduated`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Promotion Failed',
        description: `Failed to promote students: ${error.message}`,
        variant: 'destructive',
      });
    }
  });

  const resetForm = () => {
    setFormData({
      term_name: '',
      academic_year: new Date().getFullYear().toString(),
      start_date: null,
      end_date: null
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.start_date || !formData.end_date) {
      toast({
        title: 'Validation Error',
        description: 'Please select both start and end dates',
        variant: 'destructive',
      });
      return;
    }
    
    if (formData.start_date >= formData.end_date) {
      toast({
        title: 'Validation Error',
        description: 'End date must be after start date',
        variant: 'destructive',
      });
      return;
    }
    
    createTermMutation.mutate({
      term_name: formData.term_name,
      academic_year: formData.academic_year,
      start_date: formData.start_date.toISOString().split('T')[0],
      end_date: formData.end_date.toISOString().split('T')[0],
      is_current: false
    });
  };

  const currentTerm = schoolTerms.find(term => term.is_current);
  const currentYear = new Date().getFullYear();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading school calendar...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Calendar Management</h1>
          <p className="text-gray-600">Manage academic terms and student promotions</p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isPromotionDialogOpen} onOpenChange={setIsPromotionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-orange-50 hover:bg-orange-100">
                <ArrowUp className="w-4 h-4 mr-2" />
                Promote Students
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Promote Students to Next Academic Year</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    This will promote all active students to the next grade level and update their academic year.
                    Form 4 students will be marked as graduated.
                  </AlertDescription>
                </Alert>
                
                <div>
                  <Label htmlFor="promotion_year">New Academic Year</Label>
                  <Input
                    id="promotion_year"
                    value={promotionYear}
                    onChange={(e) => setPromotionYear(e.target.value)}
                    placeholder={`${currentYear}/${currentYear + 1}`}
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsPromotionDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => promoteStudentsMutation.mutate(promotionYear)}
                    disabled={!promotionYear || promoteStudentsMutation.isPending}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {promoteStudentsMutation.isPending ? 'Promoting...' : 'Promote Students'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add New Term
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New School Term</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="term_name">Term Name *</Label>
                  <Input
                    id="term_name"
                    value={formData.term_name}
                    onChange={(e) => setFormData({ ...formData, term_name: e.target.value })}
                    placeholder="e.g., Term 1, Term 2, Term 3"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="academic_year">Academic Year *</Label>
                  <Input
                    id="academic_year"
                    value={formData.academic_year}
                    onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                    placeholder="e.g., 2024/2025"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {formData.start_date ? format(formData.start_date, 'PPP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarPicker
                          mode="single"
                          selected={formData.start_date || undefined}
                          onSelect={(date) => setFormData({ ...formData, start_date: date || null })}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label>End Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {formData.end_date ? format(formData.end_date, 'PPP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarPicker
                          mode="single"
                          selected={formData.end_date || undefined}
                          onSelect={(date) => setFormData({ ...formData, end_date: date || null })}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTermMutation.isPending}>
                    {createTermMutation.isPending ? 'Creating...' : 'Create Term'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Current Term Alert */}
      {currentTerm && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Current Term:</strong> {currentTerm.term_name} ({currentTerm.academic_year})
            <span className="ml-2 text-sm">
              {format(new Date(currentTerm.start_date), 'MMM dd')} - {format(new Date(currentTerm.end_date), 'MMM dd, yyyy')}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Terms</p>
                <p className="text-2xl font-bold text-gray-900">{schoolTerms.length}</p>
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
                <p className="text-2xl font-bold text-gray-900">{studentStats?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <BookOpen className="w-8 h-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Academic Years</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Object.keys(studentStats?.byYear || {}).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CalendarDays className="w-8 h-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Active Terms</p>
                <p className="text-2xl font-bold text-gray-900">
                  {schoolTerms.filter(term => term.is_current).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Terms List */}
      <div className="grid gap-4">
        <h3 className="text-lg font-semibold">School Terms</h3>
        
        {schoolTerms.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No School Terms Yet</h3>
              <p className="text-gray-500 mb-4">Create your first school term to start managing the academic calendar</p>
              <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add First Term
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schoolTerms.map((term) => (
              <Card key={term.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{term.term_name}</CardTitle>
                    {term.is_current && (
                      <Badge className="bg-green-100 text-green-800">Current</Badge>
                    )}
                  </div>
                  <CardDescription>{term.academic_year}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm">
                      <span className="text-gray-600">Start:</span>
                      <span className="ml-2 font-medium">
                        {format(new Date(term.start_date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-600">End:</span>
                      <span className="ml-2 font-medium">
                        {format(new Date(term.end_date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    
                    {!term.is_current && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentTermMutation.mutate(term.id)}
                        disabled={setCurrentTermMutation.isPending}
                        className="w-full mt-3"
                      >
                        Set as Current
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
