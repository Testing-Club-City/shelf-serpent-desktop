import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Settings, Currency, Save, Plus } from 'lucide-react';
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
    mutationFn: async ({ id, amount, description }: { id: string; amount: number; description?: string }) => {
      const { error } = await supabase
        .from('fine_settings')
        .update({ 
          amount, 
          description,
          updated_at: new Date().toISOString() 
        })
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

  const handleCreateNew = () => {
    if (!newFineType || !newFineAmount) return;
    
    createFineSetting.mutate({
      fine_type: newFineType,
      amount: parseFloat(newFineAmount),
      description: newFineDescription
    });
  };

  const defaultFineTypes = [
    { type: 'overdue', description: 'Fine per day overdue' },
    { type: 'damaged', description: 'Fine for damaged books' },
    { type: 'lost_book', description: 'Fine for lost books' },
    { type: 'stolen_book', description: 'Fine for stealing books' },
    { type: 'theft_victim', description: 'Fine for book theft victims (usually 0)' },
    { type: 'condition_poor', description: 'Fine for poor condition return' },
    { type: 'condition_fair', description: 'Fine for fair condition return' }
  ];

  if (isLoading) {
    return <div>Loading fine settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Current Fine Settings */}
      <div className="grid gap-4">
        {fineSettings?.map((setting) => (
          <Card key={setting.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="capitalize">
                      {setting.fine_type.replace('_', ' ')}
                    </Badge>
                    <span className="font-semibold text-lg">
                      {formatCurrency(setting.amount)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {setting.description || 'No description'}
                  </p>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingFine({ ...setting })}
                >
                  Edit
                </Button>
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

      {/* Suggested Fine Types */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Fine Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {defaultFineTypes.map((item) => (
              <div key={item.type} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <span className="font-medium capitalize">{item.type.replace('_', ' ')}</span>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewFineType(item.type);
                    setNewFineDescription(item.description);
                  }}
                  disabled={fineSettings?.some(s => s.fine_type === item.type)}
                >
                  {fineSettings?.some(s => s.fine_type === item.type) ? 'Exists' : 'Add'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
