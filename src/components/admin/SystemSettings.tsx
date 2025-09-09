import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Save, GraduationCap, School, Currency, Clock, Calendar, Pencil } from 'lucide-react';
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
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

  // State for class limits - Initialize with proper structure
  const [classLimits, setClassLimits] = useState<Record<string, number>>({
    'Form 1': 2,
    'Form 2': 2,
    'Form 3': 2,
    'Form 4': 2
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

      // Load class limits with proper parsing
      const classLimitsSetting = settings.find(s => s.setting_key === 'max_books_per_class')?.setting_value;
      if (classLimitsSetting) {
        try {
          let parsedLimits;
          if (typeof classLimitsSetting === 'string') {
            parsedLimits = JSON.parse(classLimitsSetting);
          } else {
            parsedLimits = classLimitsSetting;
          }
          
          // Ensure we have a valid object with proper structure
          if (parsedLimits && typeof parsedLimits === 'object') {
            setClassLimits({
              'Form 1': Number(parsedLimits['Form 1']) || 2,
              'Form 2': Number(parsedLimits['Form 2']) || 2,
              'Form 3': Number(parsedLimits['Form 3']) || 2,
              'Form 4': Number(parsedLimits['Form 4']) || 2
            });
          }
        } catch (e) {
          console.error('Error parsing class limits:', e);
          // Keep default values on error
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
      console.log('Saving class limits:', classLimits);
      
      // Validate that all values are valid numbers
      const hasInvalidValues = Object.entries(classLimits).some(([key, value]) => {
        const numValue = Number(value);
        return isNaN(numValue) || numValue < 1 || numValue > 10;
      });
      
      if (hasInvalidValues) {
        toast({
          title: 'Validation Error',
          description: 'All class limits must be numbers between 1 and 10.',
          variant: 'destructive',
        });
        return;
      }
      
      // Ensure all values are numbers and valid for both forms and grades
      const validatedLimits = {
        'Form 1': Math.max(1, Number(classLimits['Form 1']) || 2),
        'Form 2': Math.max(1, Number(classLimits['Form 2']) || 2),
        'Form 3': Math.max(1, Number(classLimits['Form 3']) || 2),
        'Form 4': Math.max(1, Number(classLimits['Form 4']) || 2),
        'Grade 7': Math.max(1, Number(classLimits['Grade 7']) || 2),
        'Grade 8': Math.max(1, Number(classLimits['Grade 8']) || 2),
        'Grade 9': Math.max(1, Number(classLimits['Grade 9']) || 2),
        'Grade 10': Math.max(1, Number(classLimits['Grade 10']) || 2),
        'Grade 11': Math.max(1, Number(classLimits['Grade 11']) || 2),
        'Grade 12': Math.max(1, Number(classLimits['Grade 12']) || 2)
      };
      
      console.log('Validated limits:', validatedLimits);
      
      await updateSetting.mutateAsync({
        key: 'max_books_per_class',
        value: validatedLimits, // The hook will handle JSON.stringify
        description: 'Maximum books allowed per class/form level'
      });

      toast({
        title: 'Success',
        description: 'Class limits have been updated successfully.',
      });
    } catch (error) {
      console.error('Error saving class limits:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save class limits. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleClassLimitChange = (formLevel: string, value: string) => {
    const numValue = Math.max(1, parseInt(value) || 1);
    setClassLimits(prev => ({
      ...prev,
      [formLevel]: numValue
    }));
  };

  if (isLoading) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General Settings</TabsTrigger>
          <TabsTrigger value="fine-management">Fine Management</TabsTrigger>
          <TabsTrigger value="class-limits">Class Limits</TabsTrigger>
          <TabsTrigger value="academic-calendar">Academic Calendar</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-6">
          {/* Institution Information */}
          <Card className="shadow-sm border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <School className="w-5 h-5 text-blue-600" />
                Institution Information
              </CardTitle>
              <p className="text-sm text-gray-600">Basic information about your institution</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="libraryName" className="text-sm font-medium">Institution Name</Label>
                <Input
                  id="libraryName"
                  value={institutionName}
                  onChange={(e) => {
                    console.log('Institution name changed to:', e.target.value);
                    setInstitutionName(e.target.value);
                  }}
                  placeholder="Enter your institution name"
                  className="max-w-md"
                />
              </div>
            </CardContent>
          </Card>

          {/* Borrowing Policies */}
          <Card className="shadow-sm border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock className="w-5 h-5 text-green-600" />
                Borrowing Policies
              </CardTitle>
              <p className="text-sm text-gray-600">Configure borrowing rules and limitations</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="maxBorrowDays" className="text-sm font-medium">Maximum Borrow Period (Days)</Label>
                  <Input
                    id="maxBorrowDays"
                    type="number"
                    min="1"
                    max="90"
                    value={borrowingPeriod}
                    onChange={(e) => setBorrowingPeriod(e.target.value)}
                    className="max-w-32"
                  />
                  <p className="text-xs text-gray-500">Standard borrowing period for all books</p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="maxBooksPerStudent" className="text-sm font-medium">Max Books Per Student</Label>
                  <Input
                    id="maxBooksPerStudent"
                    type="number"
                    min="1"
                    max="20"
                    value={maxBooksPerStudent}
                    onChange={(e) => setMaxBooksPerStudent(e.target.value)}
                    className="max-w-32"
                  />
                  <p className="text-xs text-gray-500">Default limit (can be overridden per class)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="flex justify-end">
            <Button onClick={handleSaveGeneralSettings} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Save General Settings
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="fine-management" className="space-y-6">
          {/* Fine Management */}
          <Card className="shadow-sm border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="bg-green-100 p-1 rounded-full flex items-center justify-center w-6 h-6">
                  <KenyaShillingIcon />
                </div>
                Fine Management
              </CardTitle>
              <p className="text-sm text-gray-600">Configure fine policies and rates</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Enable Fine System</Label>
                  <p className="text-xs text-gray-600">Charge fines for overdue books and damages</p>
                </div>
                <Switch
                  checked={enableFines}
                  onCheckedChange={(checked) => setEnableFines(checked)}
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="finePerDay" className="text-sm font-medium">Fine Per Day (KSh)</Label>
                <Input
                  id="finePerDay"
                  type="number"
                  min="0"
                  max="1000"
                  value={finePerDay}
                  onChange={(e) => setFinePerDay(e.target.value)}
                  className="max-w-32"
                  disabled={!enableFines}
                />
                <p className="text-xs text-gray-500">Amount charged per day for overdue books</p>
              </div>
            </CardContent>
          </Card>
          
          <div className="flex justify-end">
            <Button onClick={handleSaveFineSettings} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Save Fine Settings
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="class-limits" className="space-y-6">
          {/* Class-Specific Limits */}
          <Card className="shadow-sm border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <GraduationCap className="w-5 h-5 text-purple-600" />
                Class-Specific Book Limits
              </CardTitle>
              <p className="text-sm text-gray-600">Set maximum books allowed per class/form level</p>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Form System */}
              <div>
                <h3 className="text-lg font-medium mb-3 text-gray-700">Form System (Secondary School)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {['Form 1', 'Form 2', 'Form 3', 'Form 4'].map((formLevel) => (
                    <div key={formLevel} className="space-y-2">
                      <Label htmlFor={`max-${formLevel}`} className="text-sm font-medium">{formLevel}</Label>
                      <Input
                        id={`max-${formLevel}`}
                        type="number"
                        min="1"
                        max="10"
                        value={classLimits[formLevel] || 2}
                        onChange={(e) => handleClassLimitChange(formLevel, e.target.value)}
                        className="max-w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Grade System */}
              <div>
                <h3 className="text-lg font-medium mb-3 text-gray-700">Grade System (Primary/CBC)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-4">
                  {['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map((gradeLevel) => (
                    <div key={gradeLevel} className="space-y-2">
                      <Label htmlFor={`max-${gradeLevel}`} className="text-sm font-medium">{gradeLevel}</Label>
                      <Input
                        id={`max-${gradeLevel}`}
                        type="number"
                        min="1"
                        max="10"
                        value={classLimits[gradeLevel] || 2}
                        onChange={(e) => handleClassLimitChange(gradeLevel, e.target.value)}
                        className="max-w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="flex justify-end">
            <Button onClick={handleSaveClassLimits} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Save Class Limits
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="academic-calendar" className="space-y-6">
          {/* Academic Calendar Management */}
          <Card className="shadow-sm border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Calendar className="w-5 h-5 text-orange-600" />
                Academic Calendar Management
              </CardTitle>
              <p className="text-sm text-gray-600">Manage school terms, academic years, and student promotions</p>
            </CardHeader>
            <CardContent>
              <EnhancedCalendarManagement />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
