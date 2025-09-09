import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Users, Eye, Edit, Trash2, Building, UserCheck, ArrowUpDown } from 'lucide-react';
import { useStaffOffline, useCreateStaffOffline, useUpdateStaffOffline, useDeleteStaffOffline } from '@/hooks/useStaffOffline';
import { StaffForm } from './StaffForm';
import { StaffDetails } from './StaffDetails';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StaffManagementProps {
  searchTerm?: string;
  openAddStaffForm?: boolean;
}

export const StaffManagement = ({ searchTerm = '', openAddStaffForm = false }: StaffManagementProps) => {
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [viewingStaff, setViewingStaff] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<string>('first_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Use offline-first hooks for better performance and offline capability
  const { data: staff, isLoading } = useStaffOffline();
  const createStaffMutation = useCreateStaffOffline();
  const updateStaffMutation = useUpdateStaffOffline();
  const deleteStaffMutation = useDeleteStaffOffline();

  // Use external search term when provided
  useEffect(() => {
    if (searchTerm) {
      setLocalSearchTerm(searchTerm);
    }
  }, [searchTerm]);

  // Reset to first page when search term or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [localSearchTerm, selectedStatus]);

  // Open add staff form if requested
  useEffect(() => {
    if (openAddStaffForm) {
      setIsAddModalOpen(true);
    }
  }, [openAddStaffForm]);

  const effectiveSearchTerm = searchTerm || localSearchTerm;

  // Calculate stats from local data
  const activeStaff = staff?.filter(s => (s as any).status === 'active').length || 0;
  const inactiveStaff = staff?.filter(s => (s as any).status !== 'active').length || 0;
  const totalStaff = staff?.length || 0;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredStaff = staff?.filter(staffMember => {
    const matchesSearch = effectiveSearchTerm === '' || 
      staffMember.first_name.toLowerCase().includes(effectiveSearchTerm.toLowerCase()) ||
      staffMember.last_name.toLowerCase().includes(effectiveSearchTerm.toLowerCase()) ||
      staffMember.staff_id.toLowerCase().includes(effectiveSearchTerm.toLowerCase()) ||
      staffMember.department?.toLowerCase().includes(effectiveSearchTerm.toLowerCase()) ||
      (staffMember as any).position?.toLowerCase().includes(effectiveSearchTerm.toLowerCase());
    
    const matchesStatus = selectedStatus === 'all' || (staffMember as any).status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  }) || [];

  // Sort the filtered staff
  const sortedStaff = [...filteredStaff].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];
    
    // Handle nested fields like first_name + last_name for full name
    if (sortField === 'name') {
      aValue = `${a.first_name} ${a.last_name}`;
      bValue = `${b.first_name} ${b.last_name}`;
    }
    
    if (aValue === bValue) return 0;
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Calculate pagination
  const totalItems = sortedStaff.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  
  // Ensure current page is within valid range
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  if (currentPage !== validCurrentPage) {
    setCurrentPage(validCurrentPage);
  }
  
  // Get current page items
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentItems = sortedStaff.slice(startIndex, endIndex);

  const handleCreateStaff = async (staffData: any) => {
    try {
      await createStaffMutation.mutateAsync(staffData);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Failed to create staff:', error);
    }
  };

  const handleUpdateStaff = async (staffData: any) => {
    if (editingStaff) {
      try {
        await updateStaffMutation.mutateAsync({ 
          staffId: editingStaff.id, 
          staffData: staffData 
        });
        setEditingStaff(null);
      } catch (error) {
        console.error('Failed to update staff:', error);
      }
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    try {
      await deleteStaffMutation.mutateAsync(staffId);
    } catch (error) {
      console.error('Failed to delete staff:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Generate pagination items
  const generatePaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    
    // Always show first page
    items.push(
      <PaginationItem key="first">
        <PaginationLink 
          isActive={validCurrentPage === 1} 
          onClick={(e) => {
            e.preventDefault();
            setCurrentPage(1);
          }}
        >
          1
        </PaginationLink>
      </PaginationItem>
    );

    // Calculate range of visible page numbers
    let startPage = Math.max(2, validCurrentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 2);
    
    if (endPage - startPage < maxVisiblePages - 2) {
      startPage = Math.max(2, endPage - (maxVisiblePages - 2));
    }

    // Add ellipsis after first page if needed
    if (startPage > 2) {
      items.push(
        <PaginationItem key="ellipsis-start">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    // Add middle pages
    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink 
            isActive={validCurrentPage === i}
            onClick={(e) => {
              e.preventDefault();
              setCurrentPage(i);
            }}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    // Add ellipsis before last page if needed
    if (endPage < totalPages - 1) {
      items.push(
        <PaginationItem key="ellipsis-end">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    // Always show last page if there's more than one page
    if (totalPages > 1) {
      items.push(
        <PaginationItem key="last">
          <PaginationLink 
            isActive={validCurrentPage === totalPages}
            onClick={(e) => {
              e.preventDefault();
              setCurrentPage(totalPages);
            }}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  const SortableHeader = ({ field, label }: { field: string, label: string }) => (
    <th 
      className="text-left py-3 px-4 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-4 w-4 text-gray-400" />
      </div>
    </th>
  );

  if (viewingStaff) {
    return (
      <StaffDetails 
        staff={viewingStaff} 
        onBack={() => setViewingStaff(null)} 
      />
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading staff...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-600">Manage staff records and borrowing privileges</p>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Staff Member</DialogTitle>
            </DialogHeader>
            <StaffForm
              onSubmit={handleCreateStaff}
              onCancel={() => setIsAddModalOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-3xl font-bold text-gray-900">{totalStaff}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Staff</p>
                <p className="text-3xl font-bold text-green-600">{activeStaff}</p>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactive Staff</p>
                <p className="text-3xl font-bold text-red-600">{inactiveStaff}</p>
              </div>
              <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {!searchTerm && (
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search staff by name, TSC number, department..."
                  value={localSearchTerm}
                  onChange={(e) => setLocalSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
            <div className="flex items-center gap-4">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select 
                value={itemsPerPage.toString()} 
                onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Items per page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
                  <tr>
                    <SortableHeader field="name" label="Staff Member" />
                    <SortableHeader field="staff_id" label="TSC Number" />
                    <SortableHeader field="department" label="Department" />
                    <SortableHeader field="position" label="Position" />
                    <SortableHeader field="status" label="Status" />
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length > 0 ? (
                    currentItems.map((staffMember) => (
                      <tr key={staffMember.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div className="font-medium text-gray-900">
                            {staffMember.first_name} {staffMember.last_name}
                          </div>
                          {staffMember.email && (
                            <div className="text-sm text-gray-500">{staffMember.email}</div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-gray-700">{staffMember.staff_id}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-700">{staffMember.department || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-gray-700">{(staffMember as any).position || 'N/A'}</td>
                        <td className="py-4 px-4">
                          <Badge className={getStatusColor((staffMember as any).status || 'active')}>
                            {(staffMember as any).status || 'Active'}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex justify-end space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setViewingStaff(staffMember)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setEditingStaff(staffMember)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {staffMember.first_name} {staffMember.last_name}? 
                                    This action cannot be undone and will affect any active borrowings.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteStaff(staffMember.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">
                        {isLoading ? (
                          <div className="flex justify-center items-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                            <span className="ml-2">Loading staff data...</span>
                          </div>
                        ) : (
                          'No staff members found'
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination className="mt-6">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (validCurrentPage > 1) setCurrentPage(validCurrentPage - 1);
                    }}
                    className={validCurrentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                {generatePaginationItems()}
                <PaginationItem>
                  <PaginationNext 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (validCurrentPage < totalPages) setCurrentPage(validCurrentPage + 1);
                    }}
                    className={validCurrentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>

      {/* Edit Staff Dialog */}
      {editingStaff && (
        <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Staff Member</DialogTitle>
            </DialogHeader>
            <StaffForm
              staff={editingStaff}
              onSubmit={handleUpdateStaff}
              onCancel={() => setEditingStaff(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};