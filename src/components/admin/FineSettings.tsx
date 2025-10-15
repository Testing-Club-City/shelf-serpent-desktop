import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Settings, Currency, Save, Plus, Power, PowerOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { KenyaShillingIcon } from '@/components/ui/currency-icon';

export const FineSettings = () => {
  const [editingFine, setEditingFine] = useState<any>(null);
  const [newFineType, setNewFineType] = useState('');
  const [newFineAmount, setNewFineAmount] = useState('');
  const [newFineDescription, setNewFineDescription] = useState('');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: fineSettings, isLoading } = useQuery({
    queryKey: ['fine-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fine_settings')
        .select('*')
        .order('fine_type');

      if (error) throw error;
      return data;
    },
  });

  const updateFineSetting = useMutation({
    mutationFn: async ({ id, amount, description, is_active }: { 
      id: string; 
      amount?: number; 
      description?: string;
      is_active?: boolean;
    }) => {
      const updates: any = { updated_at: new Date().toISOString() };
      
      if (amount !== undefined) updates.amount = amount;
      if (description !== undefined) updates.description = description;
      if (is_active !== undefined) updates.is_active = is_active;
      
      const { error } = await supabase
        .from('fine_settings')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fine-settings'] });
      setEditingFine(null);
      toast({
        title: 'Success',
        description: 'Fine setting updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update fine setting: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const createFineSetting = useMutation({
    mutationFn: async ({ fine_type, amount, description }: {
      fine_type: string;
      amount: number;
      description?: string;
    }) => {
      const { error } = await supabase
        .from('fine_settings')
        .insert({ fine_type, amount, description });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fine-settings'] });
      setNewFineType('');
      setNewFineAmount('');
      setNewFineDescription('');
      toast({
        title: 'Success',
        description: 'Fine setting created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create fine setting: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const handleSaveEdit = () => {
    if (!editingFine) return;
    
    updateFineSetting.mutate({
      id: editingFine.id,
      amount: parseFloat(editingFine.amount),
      description: editingFine.description
    });
  };

  const handleToggleActive = (id: string, currentStatus: boolean) => {
    updateFineSetting.mutate({
      id,
      is_active: !currentStatus
    });
  };

  const handleCreateNew = () => {
    if (!newFineType || !newFineAmount) return;
    
    createFineSetting.mutate({
      fine_type: newFineType,
      amount: parseFloat(newFineAmount),
      description: newFineDescription
    });
  };

  if (isLoading) {
    return <div>Loading fine settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Card with Global Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Fine System Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="font-medium">Active Fine Types</p>
              <p className="text-sm text-muted-foreground">
                {fineSettings?.filter(s => s.is_active).length || 0} of {fineSettings?.length || 0} fine types enabled
              </p>
            </div>
            <Badge variant={fineSettings?.some(s => s.is_active) ? "default" : "secondary"}>
              {fineSettings?.some(s => s.is_active) ? "System Active" : "All Disabled"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Current Fine Settings */}
      <div className="grid gap-4">
        {fineSettings?.map((setting) => (
          <Card key={setting.id} className={!setting.is_active ? 'opacity-60' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge 
                      variant={setting.is_active ? "default" : "secondary"} 
                      className="capitalize"
                    >
                      {setting.fine_type.replace('_', ' ')}
                    </Badge>
                    {!setting.is_active && (
                      <Badge variant="outline" className="text-xs">
                        <PowerOff className="h-3 w-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-2xl">
                      {formatCurrency(setting.amount)}
                    </span>
                    {setting.is_active && (
                      <span className="text-xs text-green-600 font-medium">Applied</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {setting.description || 'No description'}
                  </p>
                </div>
                
                <div className="flex flex-col gap-2 items-end">
                  {/* Activation Toggle */}
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`toggle-${setting.id}`} className="text-sm cursor-pointer">
                      {setting.is_active ? 'Active' : 'Inactive'}
                    </Label>
                    <Switch
                      id={`toggle-${setting.id}`}
                      checked={setting.is_active}
                      onCheckedChange={() => handleToggleActive(setting.id, setting.is_active)}
                      disabled={updateFineSetting.isPending}
                    />
                  </div>
                  
                  {/* Edit Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingFine({ ...setting })}
                  >
                    Edit Amount
                  </Button>
                </div>
              </div>

              {editingFine?.id === setting.id && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <div>
                    <Label>Amount (KES)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingFine.amount}
                      onChange={(e) => setEditingFine({
                        ...editingFine,
                        amount: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={editingFine.description || ''}
                      onChange={(e) => setEditingFine({
                        ...editingFine,
                        description: e.target.value
                      })}
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={updateFineSetting.isPending}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingFine(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add New Fine Setting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Fine Setting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Fine Type</Label>
            <Input
              value={newFineType}
              onChange={(e) => setNewFineType(e.target.value)}
              placeholder="e.g., late_return, special_fine"
            />
          </div>
          <div>
            <Label>Amount (KES)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={newFineAmount}
              onChange={(e) => setNewFineAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={newFineDescription}
              onChange={(e) => setNewFineDescription(e.target.value)}
              placeholder="Describe when this fine applies..."
              rows={2}
            />
          </div>
          <Button
            onClick={handleCreateNew}
            disabled={!newFineType || !newFineAmount || createFineSetting.isPending}
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Fine Setting
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
