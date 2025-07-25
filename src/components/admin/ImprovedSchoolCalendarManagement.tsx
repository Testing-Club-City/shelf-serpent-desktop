import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const TERM_OPTIONS = [
  { value: 'Term 1', label: 'Term 1 (January - April)' },
  { value: 'Term 2', label: 'Term 2 (May - August)' },
  { value: 'Term 3', label: 'Term 3 (September - December)' }
];

export const ImprovedSchoolCalendarManagement: React.FC = () => {
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
        .order('academic_year', { ascending: false })
        .order('term_name', { ascending: true });
      
      if (error) throw error;
      return data as SchoolTerm[];
    }
  });

  // Group terms by academic year
  const termsByYear = schoolTerms.reduce((acc, term) => {
    if (!acc[term.academic_year]) {
      acc[term.academic_year] = [];
    }
    acc[term.academic_year].push(term);
    return acc;
  }, {} as Record<string, SchoolTerm[]>);

  // Create term mutation
  const createTermMutation = useMutation({
    mutationFn: async (termData: Omit<SchoolTerm, 'id' | 'created_at'>) => {
      // Check if term already exists for this academic year
      const existing = schoolTerms.find(
        t => t.academic_year === termData.academic_year && t.term_name === termData.term_name
      );
      
      if (existing) {
        throw new Error(`${termData.term_name} already exists for academic year ${termData.academic_year}`);
      }

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
        description: error.message,
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
        <div className="text-gray-500">Loading academic calendar...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add New Term
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New School Term</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="academic_year">Academic Year *</Label>
                <Input
                  id="academic_year"
                  value={formData.academic_year}
                  onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                  placeholder="e.g., 2024"
                  required
                />
              </div>

              <div>
                <Label htmlFor="term_name">Term *</Label>
                <Select 
                  value={formData.term_name} 
                  onValueChange={(value) => setFormData({ ...formData, term_name: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    {TERM_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {formData.start_date ? format(formData.start_date, 'MMM dd') : 'Select'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarPicker
                        mode="single"
                        selected={formData.start_date || undefined}
                        onSelect={(date) => setFormData({ ...formData, start_date: date || null })}
                        className="p-3 pointer-events-auto"
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
                        {formData.end_date ? format(formData.end_date, 'MMM dd') : 'Select'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarPicker
                        mode="single"
                        selected={formData.end_date || undefined}
                        onSelect={(date) => setFormData({ ...formData, end_date: date || null })}
                        className="p-3 pointer-events-auto"
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

      {/* Current Term Alert */}
      {currentTerm && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Current Term:</strong> {currentTerm.term_name} {currentTerm.academic_year}
            <span className="ml-2 text-sm">
              ({format(new Date(currentTerm.start_date), 'MMM dd')} - {format(new Date(currentTerm.end_date), 'MMM dd')})
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Academic Years Overview */}
      <div className="space-y-6">
        {Object.keys(termsByYear).length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Academic Terms</h3>
              <p className="text-gray-500 mb-4">Create your first academic term to start managing the school calendar</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(termsByYear).map(([year, terms]) => (
            <Card key={year} className="overflow-hidden">
              <CardHeader className="bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Academic Year {year}</CardTitle>
                    <CardDescription>
                      {terms.length} of 3 terms configured
                    </CardDescription>
                  </div>
                  <Badge variant={terms.length === 3 ? "default" : "secondary"}>
                    {terms.length}/3 Terms
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {TERM_OPTIONS.map((termOption) => {
                    const existingTerm = terms.find(t => t.term_name === termOption.value);
                    
                    return (
                      <div key={termOption.value} className={`
                        p-4 rounded-lg border-2 transition-all
                        ${existingTerm 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-dashed border-gray-300 bg-gray-50'
                        }
                      `}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{termOption.value}</h4>
                          {existingTerm?.is_current && (
                            <Badge className="bg-blue-100 text-blue-800">Current</Badge>
                          )}
                        </div>
                        
                        {existingTerm ? (
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                              {format(new Date(existingTerm.start_date), 'MMM dd')} - {format(new Date(existingTerm.end_date), 'MMM dd')}
                            </p>
                            {!existingTerm.is_current && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCurrentTermMutation.mutate(existingTerm.id)}
                                disabled={setCurrentTermMutation.isPending}
                                className="w-full"
                              >
                                Set as Current
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="text-center">
                            <p className="text-sm text-gray-500 mb-2">Not configured</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  term_name: termOption.value,
                                  academic_year: year
                                });
                                setIsDialogOpen(true);
                              }}
                              className="w-full"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
