import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, CalendarDays, Plus, CheckCircle2, Circle, Clock, Info } from 'lucide-react';
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
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700"></div>
          <div className="text-slate-600 font-medium">Loading academic calendar...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Academic Calendar Management</h2>
          <p className="text-slate-600 mt-1">Manage 3-term academic years and student promotions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-700 hover:bg-slate-800 text-white shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Add New Term
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md border-slate-200">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Create New School Term</DialogTitle>
              <p className="text-sm text-slate-600 mt-2">
                Configure a new term for the academic calendar
              </p>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              <div>
                <Label htmlFor="academic_year" className="text-slate-700 font-medium">
                  Academic Year *
                </Label>
                <Input
                  id="academic_year"
                  value={formData.academic_year}
                  onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                  placeholder="e.g., 2025"
                  className="mt-1.5 border-slate-300 focus:border-slate-500 focus:ring-slate-500"
                  required
                />
              </div>

              <div>
                <Label htmlFor="term_name" className="text-slate-700 font-medium">
                  Term *
                </Label>
                <Select 
                  value={formData.term_name} 
                  onValueChange={(value) => setFormData({ ...formData, term_name: value })}
                >
                  <SelectTrigger className="mt-1.5 border-slate-300 focus:border-slate-500 focus:ring-slate-500">
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200">
                    {TERM_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="focus:bg-slate-100">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-700 font-medium">Start Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start mt-1.5 border-slate-300 hover:bg-slate-50 focus:border-slate-500"
                      >
                        <CalendarDays className="mr-2 h-4 w-4 text-slate-500" />
                        <span className="text-slate-700">
                          {formData.start_date ? format(formData.start_date, 'MMM dd') : 'Select'}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-slate-200">
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
                  <Label className="text-slate-700 font-medium">End Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start mt-1.5 border-slate-300 hover:bg-slate-50 focus:border-slate-500"
                      >
                        <CalendarDays className="mr-2 h-4 w-4 text-slate-500" />
                        <span className="text-slate-700">
                          {formData.end_date ? format(formData.end_date, 'MMM dd') : 'Select'}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-slate-200">
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

              <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTermMutation.isPending}
                  className="bg-slate-700 hover:bg-slate-800 text-white"
                >
                  {createTermMutation.isPending ? 'Creating...' : 'Create Term'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current Term Alert */}
      {currentTerm && (
        <Alert className="bg-slate-50 border-slate-300">
          <CheckCircle2 className="h-4 w-4 text-slate-700" />
          <AlertDescription className="text-slate-800">
            <strong>Current Term:</strong> {currentTerm.term_name} {currentTerm.academic_year}
            <span className="ml-2 text-sm text-slate-600">
              ({format(new Date(currentTerm.start_date), 'MMM dd')} - {format(new Date(currentTerm.end_date), 'MMM dd')})
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Academic Years Overview */}
      <div className="space-y-6">
        {Object.keys(termsByYear).length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Academic Terms Configured</h3>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">
                Create your first academic term to start managing the school calendar and term schedules
              </p>
              <Button 
                onClick={() => setIsDialogOpen(true)}
                className="bg-slate-700 hover:bg-slate-800 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Term
              </Button>
            </CardContent>
          </Card>
        ) : (
          Object.entries(termsByYear)
            .sort(([yearA], [yearB]) => parseInt(yearB) - parseInt(yearA))
            .map(([year, terms]) => {
              const currentYearTerm = terms.find(t => t.is_current);
              const isCurrentYear = !!currentYearTerm;
              
              return (
                <Card key={year} className="border-slate-200 shadow-sm overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white border-2 border-slate-300 rounded-lg flex items-center justify-center">
                          <Calendar className="w-6 h-6 text-slate-700" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold text-slate-900">
                            Academic Year {year}
                          </CardTitle>
                          <CardDescription className="text-slate-600 mt-1">
                            {terms.length} of 3 terms configured
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCurrentYear && (
                          <Badge className="bg-slate-700 text-white border-0 px-3 py-1">
                            Active Year
                          </Badge>
                        )}
                        <Badge 
                          variant={terms.length === 3 ? "default" : "secondary"}
                          className={terms.length === 3 
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
                            : "bg-slate-200 text-slate-700 border-slate-300"
                          }
                        >
                          {terms.length}/3 Terms
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {TERM_OPTIONS.map((termOption, index) => {
                        const existingTerm = terms.find(t => t.term_name === termOption.value);
                        const isCurrent = existingTerm?.is_current;
                        
                        return (
                          <div 
                            key={termOption.value} 
                            className={`
                              relative rounded-xl border-2 p-5 transition-all duration-200
                              ${existingTerm 
                                ? isCurrent
                                  ? 'border-slate-400 bg-slate-50 shadow-md' 
                                  : 'border-slate-300 bg-white hover:border-slate-400' 
                                : 'border-dashed border-slate-300 bg-slate-50/50 hover:bg-slate-100/80'
                              }
                            `}
                          >
                            {/* Term Header */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div className={`
                                  w-8 h-8 rounded-lg flex items-center justify-center
                                  ${existingTerm 
                                    ? 'bg-slate-700 text-white' 
                                    : 'bg-slate-200 text-slate-500'
                                  }
                                `}>
                                  {existingTerm ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                  ) : (
                                    <Circle className="w-5 h-5" />
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-semibold text-slate-900">
                                    {termOption.value}
                                  </h4>
                                  <p className="text-xs text-slate-500">
                                    {index === 0 ? 'Jan - Apr' : index === 1 ? 'May - Aug' : 'Sep - Dec'}
                                  </p>
                                </div>
                              </div>
                              
                              {isCurrent && (
                                <Badge className="bg-slate-700 text-white border-0 text-xs px-2 py-0.5">
                                  Current
                                </Badge>
                              )}
                            </div>
                            
                            {/* Term Content */}
                            {existingTerm ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm text-slate-700 bg-white p-2 rounded-lg border border-slate-200">
                                  <CalendarDays className="w-4 h-4 text-slate-500" />
                                  <span className="font-medium">
                                    {format(new Date(existingTerm.start_date), 'MMM dd')} 
                                    <span className="mx-1 text-slate-400">→</span>
                                    {format(new Date(existingTerm.end_date), 'MMM dd')}
                                  </span>
                                </div>
                                
                                {!isCurrent && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setCurrentTermMutation.mutate(existingTerm.id)}
                                    disabled={setCurrentTermMutation.isPending}
                                    className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                  >
                                    <Clock className="w-3 h-3 mr-2" />
                                    Set as Current
                                  </Button>
                                )}
                                
                                {isCurrent && (
                                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                                    <Info className="w-3 h-3" />
                                    <span>Active term for all students</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <p className="text-sm text-slate-500 text-center py-2">
                                  Term not configured
                                </p>
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
                                  className="w-full border-slate-300 text-slate-700 hover:bg-slate-700 hover:text-white transition-colors"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Configure Term
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })
        )}
      </div>
    </div>
  );
};
