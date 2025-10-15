import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Save, GraduationCap, School, Currency, Clock, Calendar, Pencil, BookOpen, Users, AlertCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSystemSettings, useUpdateSystemSetting, getSchoolNameFromSettings } from '@/hooks/useSystemSettings';
import { useClasses } from '@/hooks/useClasses';
import { KenyaShillingIcon } from '@/components/ui/currency-icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImprovedSchoolCalendarManagement } from './ImprovedSchoolCalendarManagement';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

// Term interface
interface SchoolTerm {
  id: string;
  term_name: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

// Term form data interface
interface TermFormData {
  term_name: string;
  academic_year: string;
  start_date: Date | null;
  end_date: Date | null;
}

// Term edit component
const EditTermDialog = ({ term, onSuccess }: { term: SchoolTerm, onSuccess: () => void }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<TermFormData>({
    term_name: term.term_name,
    academic_year: term.academic_year,
    start_date: term.start_date ? new Date(term.start_date) : null,
    end_date: term.end_date ? new Date(term.end_date) : null
  });

  const updateTermMutation = useMutation({
    mutationFn: async (termData: Partial<SchoolTerm>) => {
      if (!formData.start_date || !formData.end_date) {
        throw new Error('Please select both start and end dates');
      }
      
      if (formData.start_date >= formData.end_date) {
        throw new Error('End date must be after start date');
      }

      const { error } = await supabase
        .from('school_terms')
        .update({
          term_name: formData.term_name,
          academic_year: formData.academic_year,
          start_date: formData.start_date.toISOString().split('T')[0],
          end_date: formData.end_date.toISOString().split('T')[0],
        })
        .eq('id', term.id);
      
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-terms'] });
      setIsOpen(false);
      toast({
        title: 'Success',
        description: 'Term updated successfully',
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTermMutation.mutate({});
  };

  const TERM_OPTIONS = [
    { value: 'Term 1', label: 'Term 1 (January - April)' },
    { value: 'Term 2', label: 'Term 2 (May - August)' },
    { value: 'Term 3', label: 'Term 3 (September - December)' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-1" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit School Term</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="academic_year">Academic Year *</Label>
            <Input
              id="academic_year"
              value={formData.academic_year}
              onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
              placeholder="e.g., 2025"
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
                    {formData.start_date ? format(formData.start_date, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={formData.start_date || undefined}
                    onSelect={(date) => setFormData({ ...formData, start_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>End Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {formData.end_date ? format(formData.end_date, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={formData.end_date || undefined}
                    onSelect={(date) => setFormData({ ...formData, end_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={updateTermMutation.isPending}
            >
              {updateTermMutation.isPending ? 'Updating...' : 'Update Term'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Enhanced Academic Calendar Management component for settings
const EnhancedCalendarManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<TermFormData>({
    term_name: '',
    academic_year: new Date().getFullYear().toString(),
    start_date: null,
    end_date: null
  });

  // Fetch school terms
  const { data: schoolTerms = [], isLoading, refetch } = useQuery({
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

  const handleSetCurrentTerm = (termId: string) => {
    setCurrentTermMutation.mutate(termId);
  };

  const currentTerm = schoolTerms.find(term => term.is_current);
  const TERM_OPTIONS = [
    { value: 'Term 1', label: 'Term 1 (January - April)' },
    { value: 'Term 2', label: 'Term 2 (May - August)' },
    { value: 'Term 3', label: 'Term 3 (September - December)' }
  ];

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
        <div>
          <h2 className="text-xl font-semibold">Academic Calendar Management</h2>
          <p className="text-gray-600">Manage 3-term academic years and student promotions</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
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
                  placeholder="e.g., 2025"
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
                        {formData.start_date ? format(formData.start_date, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={formData.start_date || undefined}
                        onSelect={(date) => setFormData({ ...formData, start_date: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>End Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        {formData.end_date ? format(formData.end_date, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={formData.end_date || undefined}
                        onSelect={(date) => setFormData({ ...formData, end_date: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTermMutation.isPending || !formData.term_name || !formData.academic_year}
                >
                  {createTermMutation.isPending ? 'Creating...' : 'Create Term'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current Term Indicator */}
      {currentTerm && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700">
            <Calendar className="h-5 w-5" />
            <span className="font-semibold">Current Term:</span> 
            <span>{currentTerm.term_name} {currentTerm.academic_year}</span>
            <span className="text-sm text-green-600">
              ({format(new Date(currentTerm.start_date), 'MMM d')} - {format(new Date(currentTerm.end_date), 'MMM d, yyyy')})
            </span>
          </div>
        </div>
      )}

      {/* Academic Years */}
      {Object.keys(termsByYear).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(termsByYear)
            .sort(([yearA], [yearB]) => parseInt(yearB) - parseInt(yearA))
            .map(([year, terms]) => (
              <div key={year} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-4 border-b">
                  <h3 className="text-lg font-semibold">Academic Year {year}</h3>
                  <p className="text-sm text-gray-600">{terms.length} of 3 terms configured</p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['Term 1', 'Term 2', 'Term 3'].map((termName) => {
                      const term = terms.find(t => t.term_name === termName);
                      return (
                        <div key={termName} className={`border rounded-lg p-4 ${term?.is_current ? 'bg-green-50 border-green-200' : ''}`}>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold">{termName}</h4>
                            {term && (
                              <div className="flex gap-2">
                                <EditTermDialog term={term} onSuccess={() => refetch()} />
                                {!term.is_current && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleSetCurrentTerm(term.id)}
                                  >
                                    Set Current
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {term ? (
                            <div className="text-sm space-y-1">
                              <p>Start: {format(new Date(term.start_date), 'MMM d, yyyy')}</p>
                              <p>End: {format(new Date(term.end_date), 'MMM d, yyyy')}</p>
                              {term.is_current && (
                                <span className="inline-flex items-center px-2 py-1 mt-1 bg-green-100 text-green-800 text-xs rounded-full">
                                  Current Term
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-20 text-gray-400">
                              <p className="text-sm mb-2">Not configured</p>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    term_name: termName,
                                    academic_year: year
                                  });
                                  setIsDialogOpen(true);
                                }}
                              >
                                Add
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="text-center py-8 border rounded-lg bg-gray-50">
          <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No academic terms configured</h3>
          <p className="text-gray-500 mb-4">Start by adding your first school term</p>
          <Button 
            onClick={() => setIsDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Add First Term
          </Button>
        </div>
      )}
    </div>
  );
};

export const SystemSettings: React.FC = () => {
  const { data: settings = [], isLoading } = useSystemSettings();
  const updateSetting = useUpdateSystemSetting();
  const { data: classes = [] } = useClasses();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('general');

  // State for general settings
  const [institutionName, setInstitutionName] = useState('');
  const [borrowingPeriod, setBorrowingPeriod] = useState('14');
  const [maxBooksPerStudent, setMaxBooksPerStudent] = useState('3');
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [enableFines, setEnableFines] = useState(true);
  const [enableAutoFines, setEnableAutoFines] = useState(false);

  // State for class limits - Form-level based limits
  const [formLimits, setFormLimits] = useState({
    form1: 1,
    form2: 1,
    form3: 2,
    form4: 3
  });
  
  const [gradeLimits, setGradeLimits] = useState({
    grade7: 2,
    grade8: 2,
    grade9: 2,
    grade10: 2,
    grade11: 2,
    grade12: 2
  });
  
  const [finePerDay, setFinePerDay] = useState('10');

  // Load settings
  useEffect(() => {
    if (settings.length > 0) {
      console.log('Loading settings:', settings);
      
      const schoolName = getSchoolNameFromSettings(settings);
      setInstitutionName(schoolName || '');
      
      const period = settings.find(s => s.setting_key === 'borrowing_period')?.setting_value;
      setBorrowingPeriod(String(period) || '14');
      
      const maxBooks = settings.find(s => s.setting_key === 'max_books_per_student')?.setting_value;
      setMaxBooksPerStudent(String(maxBooks) || '3');
      
      const notifications = settings.find(s => s.setting_key === 'enable_notifications')?.setting_value;
      setEnableNotifications(String(notifications) === 'true');
      
      const fines = settings.find(s => s.setting_key === 'enable_fines')?.setting_value;
      setEnableFines(String(fines) === 'true');
      
      const autoFines = settings.find(s => s.setting_key === 'enable_auto_fines')?.setting_value;
      setEnableAutoFines(String(autoFines) === 'true');

      const fineAmount = settings.find(s => s.setting_key === 'fine_per_day')?.setting_value;
      setFinePerDay(String(fineAmount) || '10');

      // Load form-level limits
      const formLimitsSetting = settings.find(s => s.setting_key === 'form_level_limits')?.setting_value;
      if (formLimitsSetting) {
        try {
          const parsed = typeof formLimitsSetting === 'string' ? JSON.parse(formLimitsSetting) : formLimitsSetting;
          if (parsed && typeof parsed === 'object') {
            setFormLimits({
              form1: Number(parsed.form1) || 1,
              form2: Number(parsed.form2) || 1,
              form3: Number(parsed.form3) || 2,
              form4: Number(parsed.form4) || 3
            });
          }
        } catch (e) {
          console.error('Error parsing form limits:', e);
        }
      }
      
      // Load grade-level limits
      const gradeLimitsSetting = settings.find(s => s.setting_key === 'grade_level_limits')?.setting_value;
      if (gradeLimitsSetting) {
        try {
          const parsed = typeof gradeLimitsSetting === 'string' ? JSON.parse(gradeLimitsSetting) : gradeLimitsSetting;
          if (parsed && typeof parsed === 'object') {
            setGradeLimits({
              grade7: Number(parsed.grade7) || 2,
              grade8: Number(parsed.grade8) || 2,
              grade9: Number(parsed.grade9) || 2,
              grade10: Number(parsed.grade10) || 2,
              grade11: Number(parsed.grade11) || 2,
              grade12: Number(parsed.grade12) || 2
            });
          }
        } catch (e) {
          console.error('Error parsing grade limits:', e);
        }
      }
    }
  }, [settings]);

  const handleSaveGeneralSettings = async () => {
    try {
      console.log('Saving general settings...');
      
      await Promise.all([
        updateSetting.mutateAsync({
          key: 'school_name',
          value: institutionName,
          description: 'School/Institution name displayed in the system'
        }),
        updateSetting.mutateAsync({
          key: 'borrowing_period',
          value: borrowingPeriod,
          description: 'Standard borrowing period for all books'
        }),
        updateSetting.mutateAsync({
          key: 'max_books_per_student',
          value: maxBooksPerStudent,
          description: 'Default limit (can be overridden per class)'
        }),
        updateSetting.mutateAsync({
          key: 'enable_notifications',
          value: enableNotifications.toString(),
          description: 'Enable notifications for overdue books'
        }),
        updateSetting.mutateAsync({
          key: 'enable_fines',
          value: enableFines.toString(),
          description: 'Enable fine system'
        }),
        updateSetting.mutateAsync({
          key: 'enable_auto_fines',
          value: enableAutoFines.toString(),
          description: 'Enable automatic fine system'
        })
      ]);

      toast({
        title: 'Settings Saved',
        description: 'All general settings have been updated successfully.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveFineSettings = async () => {
    try {
      console.log('Saving fine settings...');
      
      await Promise.all([
        updateSetting.mutateAsync({
          key: 'enable_fines',
          value: enableFines.toString(),
          description: 'Enable fine system'
        }),
        updateSetting.mutateAsync({
          key: 'fine_per_day',
          value: finePerDay,
          description: 'Amount charged per day for overdue books'
        })
      ]);

      toast({
        title: 'Settings Saved',
        description: 'Fine settings have been updated successfully.',
      });
    } catch (error) {
      console.error('Error saving fine settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save fine settings. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveClassLimits = async () => {
    try {
      console.log('Saving form limits:', formLimits);
      console.log('Saving grade limits:', gradeLimits);
      
      // Validate form limits
      const hasInvalidFormValues = Object.values(formLimits).some(value => {
        const numValue = Number(value);
        return isNaN(numValue) || numValue < 1 || numValue > 10;
      });
      
      // Validate grade limits
      const hasInvalidGradeValues = Object.values(gradeLimits).some(value => {
        const numValue = Number(value);
        return isNaN(numValue) || numValue < 1 || numValue > 10;
      });
      
      if (hasInvalidFormValues || hasInvalidGradeValues) {
        toast({
          title: 'Validation Error',
          description: 'All limits must be numbers between 1 and 10.',
          variant: 'destructive',
        });
        return;
      }
      
      // Save form-level limits
      await updateSetting.mutateAsync({
        key: 'form_level_limits',
        value: formLimits,
        description: 'Maximum books allowed per form level (applies to all sections)'
      });
      
      // Save grade-level limits
      await updateSetting.mutateAsync({
        key: 'grade_level_limits',
        value: gradeLimits,
        description: 'Maximum books allowed per grade level (applies to all sections)'
      });

      // Now update all classes in the database to use form-level limits
      await invoke('update_class_limits_by_form_level', { 
        formLimits: {
          1: formLimits.form1,
          2: formLimits.form2,
          3: formLimits.form3,
          4: formLimits.form4
        },
        gradeLimits: {
          7: gradeLimits.grade7,
          8: gradeLimits.grade8,
          9: gradeLimits.grade9,
          10: gradeLimits.grade10,
          11: gradeLimits.grade11,
          12: gradeLimits.grade12
        }
      });

      toast({
        title: 'Success',
        description: 'Borrowing limits have been updated for all classes successfully.',
      });
    } catch (error) {
      console.error('Error saving class limits:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save borrowing limits. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleFormLimitChange = (formKey: keyof typeof formLimits, value: string) => {
    const numValue = Math.max(1, Math.min(10, parseInt(value) || 1));
    setFormLimits(prev => ({
      ...prev,
      [formKey]: numValue
    }));
  };

  const handleGradeLimitChange = (gradeKey: keyof typeof gradeLimits, value: string) => {
    const numValue = Math.max(1, Math.min(10, parseInt(value) || 1));
    setGradeLimits(prev => ({
      ...prev,
      [gradeKey]: numValue
    }));
  };

  if (isLoading) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-lg">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Borrowing Limits Configuration</h1>
            <p className="text-purple-100 mt-1">
              Set maximum books allowed per form/grade level (applies to all class sections)
            </p>
          </div>
        </div>
      </div>

      {/* Information Alert */}
      <Alert className="bg-slate-50 border-slate-300">
        <Info className="h-4 w-4 text-slate-700" />
        <AlertDescription className="text-slate-800">
          <strong>Form/Grade Level Limits:</strong> Set borrowing limits that apply to ALL sections of the same form or grade.
          For example, Form 2A, Form 2B, and Form 2C will all use the same Form 2 limit.
        </AlertDescription>
      </Alert>

      {/* Secondary School - Form System */}
      <Card className="shadow-sm border border-slate-200 bg-white">
        <CardHeader className="pb-4 border-b border-slate-200 bg-slate-50">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-slate-100 rounded-lg">
              <GraduationCap className="w-6 h-6 text-slate-700" />
            </div>
            <div>
              <div className="text-slate-900">Secondary School (Form System)</div>
              <p className="text-sm font-normal text-slate-600 mt-1">
                Configure maximum books per student for Form 1-4 (applies to all sections)
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { key: 'form1' as const, label: 'Form 1', recommended: 1 },
              { key: 'form2' as const, label: 'Form 2', recommended: 1 },
              { key: 'form3' as const, label: 'Form 3', recommended: 2 },
              { key: 'form4' as const, label: 'Form 4', recommended: 3 }
            ].map(({ key, label, recommended }) => (
              <div key={key} className="p-5 rounded-lg border-2 border-slate-200 bg-slate-50 hover:border-slate-300 hover:shadow-md transition-all duration-200">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`limit-${key}`} className="text-base font-semibold text-slate-800">
                      {label}
                    </Label>
                    <div className="px-2 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
                      All Sections
                    </div>
                  </div>
                  
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id={`limit-${key}`}
                      type="number"
                      min="1"
                      max="10"
                      value={formLimits[key]}
                      onChange={(e) => handleFormLimitChange(key, e.target.value)}
                      className="pl-10 text-center text-lg font-bold border-2 border-slate-200 focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Users className="w-3 h-3" />
                    <span>Max {formLimits[key]} book{formLimits[key] > 1 ? 's' : ''} per student</span>
                  </div>
                  
                  {formLimits[key] !== recommended && (
                    <div className="text-xs text-slate-500 italic flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Recommended: {recommended}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-slate-100 rounded-lg border border-slate-200">
            <div className="flex items-start gap-2 text-sm text-slate-700">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Note:</strong> These limits apply to ALL classes in each form. 
                For example, Form 2A, Form 2B, Form 2C, Form 2 East, and Form 2 West will all use the Form 2 limit of <strong>{formLimits.form2} book(s)</strong>.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Primary School / CBC - Grade System */}
      <Card className="shadow-sm border border-slate-200 bg-white">
        <CardHeader className="pb-4 border-b border-slate-200 bg-slate-50">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-slate-100 rounded-lg">
              <School className="w-6 h-6 text-slate-700" />
            </div>
            <div>
              <div className="text-slate-900">Primary School / CBC (Grade System)</div>
              <p className="text-sm font-normal text-slate-600 mt-1">
                Configure maximum books per student for Grade 7-12 (applies to all sections)
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { key: 'grade7' as const, label: 'Grade 7' },
              { key: 'grade8' as const, label: 'Grade 8' },
              { key: 'grade9' as const, label: 'Grade 9' },
              { key: 'grade10' as const, label: 'Grade 10' },
              { key: 'grade11' as const, label: 'Grade 11' },
              { key: 'grade12' as const, label: 'Grade 12' }
            ].map(({ key, label }) => (
              <div key={key} className="p-4 rounded-lg border-2 border-slate-200 bg-slate-50 hover:border-slate-300 hover:shadow-md transition-all duration-200">
                <div className="space-y-2">
                  <Label htmlFor={`limit-${key}`} className="text-sm font-semibold text-slate-800">
                    {label}
                  </Label>
                  <div className="relative">
                    <Input
                      id={`limit-${key}`}
                      type="number"
                      min="1"
                      max="10"
                      value={gradeLimits[key]}
                      onChange={(e) => handleGradeLimitChange(key, e.target.value)}
                      className="text-center text-lg font-bold border-2 border-slate-200 focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                    />
                  </div>
                  <div className="text-xs text-slate-600 text-center">
                    Max {gradeLimits[key]} book{gradeLimits[key] > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-slate-100 rounded-lg border border-slate-200">
            <div className="flex items-start gap-2 text-sm text-slate-700">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>CBC System:</strong> All sections of the same grade share the same borrowing limit.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button 
          variant="outline" 
          onClick={() => {
            setFormLimits({ form1: 1, form2: 1, form3: 2, form4: 3 });
            setGradeLimits({ grade7: 2, grade8: 2, grade9: 2, grade10: 2, grade11: 2, grade12: 2 });
          }}
          className="border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          Reset to Defaults
        </Button>
        <Button 
          onClick={handleSaveClassLimits} 
          className="bg-slate-700 hover:bg-slate-800 text-white shadow-sm"
          size="lg"
        >
          <Save className="w-5 h-5 mr-2" />
          Save Borrowing Limits
        </Button>
      </div>
    </div>
  );
};
