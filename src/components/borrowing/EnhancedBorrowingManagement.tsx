
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Plus, Search, Filter, Users, AlertTriangle, RotateCcw, Eye, QrCode, ArrowLeftRight } from 'lucide-react';
import { useBorrowingsArray, useCreateMultipleBorrowings, useOverdueBorrowings } from '@/hooks/useBorrowings';
import { TrackingCodeBorrowingForm } from './TrackingCodeBorrowingForm';
import { TrackingCodeReturnForm } from './TrackingCodeReturnForm';
import AvailableCopiesCard from './AvailableCopiesCard';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export const EnhancedBorrowingManagement = () => {
  const { data: borrowings, isLoading } = useBorrowingsArray();
  const { data: overdueBorrowingsData } = useOverdueBorrowings();
  const overdueBorrowings = overdueBorrowingsData?.data || [];
  const createBorrowing = useCreateMultipleBorrowings();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isIssueFormOpen, setIsIssueFormOpen] = useState(false);
  const [isReturnFormOpen, setIsReturnFormOpen] = useState(false);

  const activeBorrowings = borrowings?.filter(b => b.status === 'active') || [];
  const returnedBorrowings = borrowings?.filter(b => b.status === 'returned') || [];

  const filteredBorrowings = (borrowings || []).filter(borrowing => {
    const matchesSearch = searchTerm === '' ||
      borrowing.students?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrowing.students?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrowing.students?.admission_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrowing.books?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrowing.tracking_code?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || borrowing.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleCreateBorrowing = async (borrowings: any[]) => {
    try {
      await createBorrowing.mutateAsync(borrowings);
      setIsIssueFormOpen(false);
      toast({
        title: 'Success',
        description: `${borrowings.length} book${borrowings.length !== 1 ? 's' : ''} issued successfully`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const calculateFine = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays * 10 : 0; // KSH 10 per day
  };

  const getBorrowingsByTab = () => {
    switch (activeTab) {
      case 'active':
        return activeBorrowings || [];
      case 'overdue':
        return overdueBorrowings;
      case 'returned':
        return returnedBorrowings || [];
      default:
        return filteredBorrowings || [];
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <QrCode className="w-8 h-8 text-primary" />
            Tracking Code Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Efficient book borrowing using tracking codes
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsReturnFormOpen(true)} variant="outline" className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" />
            Return Book
          </Button>
          <Button onClick={() => setIsIssueFormOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Issue Books
          </Button>
        </div>
      </div>

      {/* Available Copies Overview Card */}
      <AvailableCopiesCard />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active Borrowings</p>
                <p className="text-2xl font-bold">{activeBorrowings?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Overdue Books</p>
                <p className="text-2xl font-bold">{overdueBorrowings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Returned Today</p>
                <p className="text-2xl font-bold">
                  {returnedBorrowings?.filter(b => 
                    b.returned_date === new Date().toISOString().split('T')[0]
                  ).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active Borrowers</p>
                <p className="text-2xl font-bold">
                  {new Set(activeBorrowings?.map(b => b.student_id) || []).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by student, book title, or tracking code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Borrowings Table with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Borrowing Records</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-4 w-full max-w-md">
              <TabsTrigger value="active">Active ({activeBorrowings?.length || 0})</TabsTrigger>
              <TabsTrigger value="overdue">Overdue ({overdueBorrowings.length})</TabsTrigger>
              <TabsTrigger value="returned">Returned ({returnedBorrowings?.length || 0})</TabsTrigger>
              <TabsTrigger value="all">All ({filteredBorrowings?.length || 0})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {isLoading ? (
                <div className="text-center py-8">Loading borrowings...</div>
              ) : (getBorrowingsByTab() || []).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Book & Tracking Code</TableHead>
                      <TableHead>Borrowed Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Fine</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(getBorrowingsByTab() || []).map((borrowing) => {
                      const isOverdue = borrowing.status === 'active' && new Date(borrowing.due_date) < new Date();
                      const fine = isOverdue ? calculateFine(borrowing.due_date) : borrowing.fine_amount || 0;
                      
                      return (
                        <TableRow key={borrowing.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {borrowing.students?.first_name} {borrowing.students?.last_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {borrowing.students?.admission_number}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{borrowing.books?.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {borrowing.tracking_code || 'No tracking code'}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(borrowing.borrowed_date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            <div className={isOverdue ? 'text-red-600' : ''}>
                              {format(new Date(borrowing.due_date), 'MMM dd, yyyy')}
                              {isOverdue && <AlertTriangle className="w-4 h-4 inline ml-1" />}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              borrowing.status === 'active' ? (isOverdue ? 'destructive' : 'default') :
                              borrowing.status === 'returned' ? 'secondary' : 'outline'
                            }>
                              {isOverdue ? 'Overdue' : borrowing.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {borrowing.condition_at_issue || 'Good'}
                            </Badge>
                            {borrowing.condition_at_return && (
                              <div className="mt-1">
                                <Badge variant="secondary">
                                  Returned: {borrowing.condition_at_return}
                                </Badge>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {fine > 0 && (
                              <Badge variant="destructive">
                                KSH {fine}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <QrCode className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No borrowings found</h3>
                  <p className="text-muted-foreground mb-4">
                    {activeTab === 'active' ? 'No active borrowings at the moment.' :
                     activeTab === 'overdue' ? 'No overdue books! Great job.' :
                     activeTab === 'returned' ? 'No returned books yet.' :
                     'No borrowing records match your search.'}
                  </p>
                  {activeTab === 'active' && (
                    <Button onClick={() => setIsIssueFormOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Issue First Book
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Issue Books Dialog */}
      <Dialog open={isIssueFormOpen} onOpenChange={setIsIssueFormOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Issue Books by Tracking Code</DialogTitle>
          </DialogHeader>
          <TrackingCodeBorrowingForm
            onSubmit={handleCreateBorrowing}
            onCancel={() => setIsIssueFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Return Book Dialog */}
      <Dialog open={isReturnFormOpen} onOpenChange={setIsReturnFormOpen}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Return Book by Tracking Code</DialogTitle>
          </DialogHeader>
          <TrackingCodeReturnForm
            onCancel={() => setIsReturnFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
