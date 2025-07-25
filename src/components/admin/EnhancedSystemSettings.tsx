import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSystemSettings, useUpdateSystemSetting } from '@/hooks/useSystemSettings';
import { useClasses } from '@/hooks/useClasses';
import { Settings, School, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const EnhancedSystemSettings = () => {
  const { data: settings, isLoading } = useSystemSettings();
  const { data: classes } = useClasses();
  const updateSetting = useUpdateSystemSetting();
  const { toast } = useToast();
  
  const [schoolName, setSchoolName] = useState('');
  const [fineSettings, setFineSettings] = useState({
    per_day: 10,
    torn_book: 50,
    damaged_book: 100,
    dirty_book: 20,
    lost_book: 500,
    stolen_book: 1000
  });
  const [maxBooks, setMaxBooks] = useState({
    form1: 2,
    form2: 2,
    form3: 3,
    form4: 3
  });

  // Load current settings
  useEffect(() => {
    if (settings) {
      const schoolSetting = settings.find(s => s.setting_key === 'school_name');
      const fineSetting = settings.find(s => s.setting_key === 'fine_settings');
      const maxBooksSetting = settings.find(s => s.setting_key === 'max_books_per_student');
      
      if (schoolSetting && schoolSetting.setting_value) {
        try {
          const value = typeof schoolSetting.setting_value === 'string' 
            ? JSON.parse(schoolSetting.setting_value) 
            : schoolSetting.setting_value;
          setSchoolName(value);
        } catch (error) {
          console.error('Error parsing school name:', error);
        }
      }
      
      if (fineSetting && fineSetting.setting_value) {
        try {
          const value = typeof fineSetting.setting_value === 'string' 
            ? JSON.parse(fineSetting.setting_value) 
            : fineSetting.setting_value;
          setFineSettings({ ...fineSettings, ...value });
        } catch (error) {
          console.error('Error parsing fine settings:', error);
        }
      }
      
      if (maxBooksSetting && maxBooksSetting.setting_value) {
        try {
          const value = typeof maxBooksSetting.setting_value === 'string' 
            ? JSON.parse(maxBooksSetting.setting_value) 
            : maxBooksSetting.setting_value;
          setMaxBooks({ ...maxBooks, ...value });
        } catch (error) {
          console.error('Error parsing max books:', error);
        }
      }
    }
  }, [settings]);

  const handleUpdateSchoolName = async () => {
    if (!schoolName.trim()) {
      toast({
        title: 'Error',
        description: 'School name cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateSetting.mutateAsync({
        key: 'school_name',
        value: schoolName,
        description: 'School/Institution name displayed in the system'
      });
    } catch (error) {
      console.error('Error updating school name:', error);
    }
  };

  const handleUpdateFineSettings = async () => {
    // Validate fine amounts
    const invalidValues = Object.entries(fineSettings).filter(([key, value]) => 
      value < 0 || isNaN(value)
    );

    if (invalidValues.length > 0) {
      toast({
        title: 'Error',
        description: 'Fine amounts must be valid positive numbers',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateSetting.mutateAsync({
        key: 'fine_settings',
        value: fineSettings,
        description: 'Fine amounts for different book conditions and overdue books'
      });
    } catch (error) {
      console.error('Error updating fine settings:', error);
    }
  };

  const handleUpdateMaxBooks = async () => {
    // Validate max books values
    const invalidValues = Object.entries(maxBooks).filter(([key, value]) => 
      value < 1 || value > 10 || isNaN(value)
    );

    if (invalidValues.length > 0) {
      toast({
        title: 'Error',
        description: 'Maximum books must be between 1 and 10',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateSetting.mutateAsync({
        key: 'max_books_per_student',
        value: maxBooks,
        description: 'Maximum books allowed per form level'
      });
    } catch (error) {
      console.error('Error updating max books:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Enhanced System Settings</h1>
          <p className="text-muted-foreground">Configure detailed system-wide settings and preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* School Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="w-5 h-5" />
              School Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="schoolName">School Name</Label>
              <Input
                id="schoolName"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g., Kisii University"
              />
            </div>
            <Button 
              onClick={handleUpdateSchoolName} 
              disabled={updateSetting.isPending || !schoolName.trim()}
              className="w-full"
            >
              {updateSetting.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update School Name'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Enhanced Fine Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="bg-green-100 p-1 rounded-full flex items-center justify-center w-6 h-6">
                <span className="text-green-700 font-bold text-xs">KSh</span>
              </div>
              Fine Settings (KSh)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="per_day">Per Day (Overdue)</Label>
                <Input
                  id="per_day"
                  type="number"
                  min="0"
                  value={fineSettings.per_day}
                  onChange={(e) => setFineSettings({...fineSettings, per_day: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label htmlFor="torn_book">Torn Book</Label>
                <Input
                  id="torn_book"
                  type="number"
                  min="0"
                  value={fineSettings.torn_book}
                  onChange={(e) => setFineSettings({...fineSettings, torn_book: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label htmlFor="damaged_book">Damaged Book</Label>
                <Input
                  id="damaged_book"
                  type="number"
                  min="0"
                  value={fineSettings.damaged_book}
                  onChange={(e) => setFineSettings({...fineSettings, damaged_book: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label htmlFor="dirty_book">Dirty Book</Label>
                <Input
                  id="dirty_book"
                  type="number"
                  min="0"
                  value={fineSettings.dirty_book}
                  onChange={(e) => setFineSettings({...fineSettings, dirty_book: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label htmlFor="lost_book">Lost Book</Label>
                <Input
                  id="lost_book"
                  type="number"
                  min="0"
                  value={fineSettings.lost_book}
                  onChange={(e) => setFineSettings({...fineSettings, lost_book: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label htmlFor="stolen_book">Stolen Book</Label>
                <Input
                  id="stolen_book"
                  type="number"
                  min="0"
                  value={fineSettings.stolen_book}
                  onChange={(e) => setFineSettings({...fineSettings, stolen_book: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
            <Button 
              onClick={handleUpdateFineSettings} 
              disabled={updateSetting.isPending}
              className="w-full"
            >
              {updateSetting.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Fine Settings'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Maximum Books Settings */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Maximum Books Per Student
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="form1">Form 1 Students</Label>
                <Input
                  id="form1"
                  type="number"
                  min="1"
                  max="10"
                  value={maxBooks.form1}
                  onChange={(e) => setMaxBooks({...maxBooks, form1: parseInt(e.target.value) || 1})}
                />
              </div>
              <div>
                <Label htmlFor="form2">Form 2 Students</Label>
                <Input
                  id="form2"
                  type="number"
                  min="1"
                  max="10"
                  value={maxBooks.form2}
                  onChange={(e) => setMaxBooks({...maxBooks, form2: parseInt(e.target.value) || 1})}
                />
              </div>
              <div>
                <Label htmlFor="form3">Form 3 Students</Label>
                <Input
                  id="form3"
                  type="number"
                  min="1"
                  max="10"
                  value={maxBooks.form3}
                  onChange={(e) => setMaxBooks({...maxBooks, form3: parseInt(e.target.value) || 1})}
                />
              </div>
              <div>
                <Label htmlFor="form4">Form 4 Students</Label>
                <Input
                  id="form4"
                  type="number"
                  min="1"
                  max="10"
                  value={maxBooks.form4}
                  onChange={(e) => setMaxBooks({...maxBooks, form4: parseInt(e.target.value) || 1})}
                />
              </div>
            </div>
            <Button 
              onClick={handleUpdateMaxBooks} 
              disabled={updateSetting.isPending}
              className="w-full"
            >
              {updateSetting.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Maximum Books'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Condition Guidelines */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Book Condition Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium text-green-600">Good Condition</h4>
                <p className="text-muted-foreground">Book is in excellent state with no visible damage</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-yellow-600">Minor Issues</h4>
                <ul className="text-muted-foreground space-y-1">
                  <li>• <strong>Dirty:</strong> Stains or marks that can be cleaned</li>
                  <li>• <strong>Torn:</strong> Minor tears in pages or cover</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-red-600">Major Issues</h4>
                <ul className="text-muted-foreground space-y-1">
                  <li>• <strong>Damaged:</strong> Significant structural damage</li>
                  <li>• <strong>Lost:</strong> Book cannot be found</li>
                  <li>• <strong>Stolen:</strong> Book was deliberately taken</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
