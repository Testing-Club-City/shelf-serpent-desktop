import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAllProfiles, useCreateLibrarian, useCreateAdmin, useUpdateLibrarian, useDeleteLibrarian, useSuspendLibrarian } from '@/hooks/useProfile';
import { UserActivityDetails } from './UserActivityDetails';
import { Plus, Users, Loader2, Mail, Phone, Calendar, Edit, Trash2, UserX, UserCheck, Shield, Activity } from 'lucide-react';
import { format } from 'date-fns';

// Extended profile type to include all the fields we need
interface ExtendedProfile {
  id: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  suspended?: boolean;
}

export const LibrarianManagement = () => {
  const { data: profiles, isLoading } = useAllProfiles();
  const createLibrarian = useCreateLibrarian();
  const createAdmin = useCreateAdmin();
  const updateLibrarian = useUpdateLibrarian();
  const deleteLibrarian = useDeleteLibrarian();
  const suspendLibrarian = useSuspendLibrarian();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ExtendedProfile | null>(null);
  const [selectedUserActivity, setSelectedUserActivity] = useState<ExtendedProfile | null>(null);
  
  const [createFormData, setCreateFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'librarian' as 'librarian' | 'admin',
  });

  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  });

  const [formErrors, setFormErrors] = useState({
    email: '',
    password: '',
  });

  // If viewing user activity details, show that component
  if (selectedUserActivity) {
    return (
      <UserActivityDetails
        userId={selectedUserActivity.id}
        userName={`${selectedUserActivity.first_name || ''} ${selectedUserActivity.last_name || ''}`.trim() || selectedUserActivity.email}
        userRole={selectedUserActivity.role}
        onBack={() => setSelectedUserActivity(null)}
      />
    );
  }

  const validateCreateForm = () => {
    let isValid = true;
    const errors = { email: '', password: '' };

    // Email validation
    if (!createFormData.email) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(createFormData.email)) {
      errors.email = 'Email is invalid';
      isValid = false;
    }

    // Password validation
    if (!createFormData.password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (createFormData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateCreateForm()) {
      return;
    }
    
    const { email, password, role, ...profile } = createFormData;
    
    const mutation = role === 'admin' ? createAdmin : createLibrarian;
    
    mutation.mutate(
      { email, password, profile },
      {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
          setCreateFormData({
            email: '',
            password: '',
            first_name: '',
            last_name: '',
            phone: '',
            role: 'librarian',
          });
          setFormErrors({ email: '', password: '' });
        },
      }
    );
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    
    updateLibrarian.mutate(
      { id: editingProfile.id, updates: editFormData },
      {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setEditingProfile(null);
          setEditFormData({
            first_name: '',
            last_name: '',
            phone: '',
          });
        },
      }
    );
  };

  const openEditDialog = (profile: ExtendedProfile) => {
    setEditingProfile(profile);
    setEditFormData({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      phone: profile.phone || '',
    });
    setIsEditDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Type assertion to handle the extended profile properties
  const extendedProfiles = profiles as ExtendedProfile[];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User Account</DialogTitle>
              <DialogDescription>
                Create a new librarian or admin account with access to the library management system.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <Label htmlFor="create_role">Role *</Label>
                <Select 
                  value={createFormData.role} 
                  onValueChange={(value: 'librarian' | 'admin') => 
                    setCreateFormData({ ...createFormData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="librarian">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-2" />
                        Librarian
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center">
                        <Shield className="w-4 h-4 mr-2" />
                        Admin
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create_first_name">First Name *</Label>
                  <Input
                    id="create_first_name"
                    value={createFormData.first_name}
                    onChange={(e) => setCreateFormData({ ...createFormData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="create_last_name">Last Name *</Label>
                  <Input
                    id="create_last_name"
                    value={createFormData.last_name}
                    onChange={(e) => setCreateFormData({ ...createFormData, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="create_email">Email *</Label>
                <Input
                  id="create_email"
                  type="email"
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                  required
                  className={formErrors.email ? "border-red-500" : ""}
                />
                {formErrors.email && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.email}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="create_password">Password *</Label>
                <Input
                  id="create_password"
                  type="password"
                  value={createFormData.password}
                  onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                  required
                  className={formErrors.password ? "border-red-500" : ""}
                  placeholder="Minimum 6 characters"
                />
                {formErrors.password && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.password}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="create_phone">Phone Number</Label>
                <Input
                  id="create_phone"
                  value={createFormData.phone}
                  onChange={(e) => setCreateFormData({ ...createFormData, phone: e.target.value })}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setIsCreateDialogOpen(false);
                  setFormErrors({ email: '', password: '' });
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createLibrarian.isPending || createAdmin.isPending}>
                  {(createLibrarian.isPending || createAdmin.isPending) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    `Create ${createFormData.role === 'admin' ? 'Admin' : 'Librarian'}`
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_first_name">First Name</Label>
                <Input
                  id="edit_first_name"
                  value={editFormData.first_name}
                  onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_last_name">Last Name</Label>
                <Input
                  id="edit_last_name"
                  value={editFormData.last_name}
                  onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="edit_phone">Phone Number</Label>
              <Input
                id="edit_phone"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateLibrarian.isPending}>
                {updateLibrarian.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  'Update User'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <CardTitle>All Users</CardTitle>
          </div>
          <CardDescription>
            View and manage all user accounts in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extendedProfiles?.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">
                    {profile.first_name && profile.last_name ? (
                      `${profile.first_name} ${profile.last_name}`
                    ) : (
                      profile.email
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span>{profile.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                      {profile.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                      {profile.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {profile.phone ? (
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{profile.phone}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={profile.suspended ? 'destructive' : 'default'}>
                      {profile.suspended ? 'Suspended' : 'Active'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>{format(new Date(profile.created_at), 'MMM dd, yyyy')}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(profile.role === 'librarian' || profile.role === 'admin') && (
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedUserActivity(profile)}
                          title="View user activities"
                        >
                          <Activity className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(profile)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => suspendLibrarian.mutate({ 
                            id: profile.id, 
                            suspended: !profile.suspended 
                          })}
                          disabled={suspendLibrarian.isPending}
                        >
                          {profile.suspended ? (
                            <UserCheck className="w-4 h-4" />
                          ) : (
                            <UserX className="w-4 h-4" />
                          )}
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this {profile.role} account? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteLibrarian.mutate(profile.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
