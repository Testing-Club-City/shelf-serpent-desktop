import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  ShieldAlert, 
  User, 
  BookOpen, 
  Calendar, 
  Hash,
  AlertTriangle,
  CheckCircle,
  Clock,
  Currency,
  X
} from 'lucide-react';
import { useTheftReports } from '@/hooks/useBorrowings';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useFines } from '@/hooks/useFineManagement';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { KenyaShillingIcon } from '@/components/ui/currency-icon';

export const TheftReportsManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [showFineDialog, setShowFineDialog] = useState(false);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { data: theftReports = [], isLoading, error } = useTheftReports();
  const { data: fines = [] } = useFines();
  const { toast } = useToast();

  const filteredReports = theftReports.filter(report => {
    const studentName = `${report.students?.first_name} ${report.students?.last_name}`;
    const matchesSearch = searchTerm === '' || (
      studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.students?.admission_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.books?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.expected_tracking_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.returned_tracking_code.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reported':
        return 'bg-red-100 text-red-800';
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'reported':
        return <ShieldAlert className="w-4 h-4" />;
      case 'investigating':
        return <Clock className="w-4 h-4" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4" />;
      case 'closed':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const handleCollectFine = async () => {
    if (!selectedReport) return;
    
    setIsProcessing(true);
    try {
      // Find related fine
      const relatedFine = fines.find(fine => 
        fine.fine_type === 'stolen_book' && 
        fine.student_id === selectedReport.student_id
      );
      
      if (relatedFine) {
        // Update existing fine
        await supabase
          .from('fines')
          .update({
            status: 'paid',
            updated_at: new Date().toISOString(),
            amount_paid: collectAmount
          })
          .eq('id', relatedFine.id);
      } else {
        // Create new fine record
        await supabase
          .from('fines')
          .insert({
            student_id: selectedReport.student_id,
            borrowing_id: selectedReport.borrowing_id,
            amount: collectAmount,
            amount_paid: collectAmount,
            fine_type: 'stolen_book',
            description: `Theft fine: Book ${selectedReport.expected_tracking_code} taken from another student`,
            status: 'paid',
            created_at: new Date().toISOString()
          });
      }
      
      // Update theft report status
      await supabase
        .from('theft_reports')
        .update({
          status: 'resolved',
          resolution_date: new Date().toISOString(),
          resolution_notes: `Fine of KES ${collectAmount} collected from student`
        })
        .eq('id', selectedReport.id);
        
      toast({
        title: 'Fine Collected',
        description: `Successfully collected KES ${collectAmount} fine for theft case`,
      });
      
      setShowFineDialog(false);
      setSelectedReport(null);
      
      // Refresh data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error collecting fine:', error);
      toast({
        title: 'Error',
        description: 'Failed to collect fine. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleWaiveFine = async () => {
    if (!selectedReport) return;
    
    setIsProcessing(true);
    try {
      // Find related fine
      const relatedFine = fines.find(fine => 
        fine.fine_type === 'stolen_book' && 
        fine.student_id === selectedReport.student_id
      );
      
      if (relatedFine) {
        // Update existing fine
        await supabase
          .from('fines')
          .update({
            status: 'cleared',
            updated_at: new Date().toISOString(),
            notes: 'Fine waived by administrator'
          })
          .eq('id', relatedFine.id);
      }
      
      // Update theft report status
      await supabase
        .from('theft_reports')
        .update({
          status: 'resolved',
          resolution_date: new Date().toISOString(),
          resolution_notes: 'Fine waived by administrator'
        })
        .eq('id', selectedReport.id);
        
      toast({
        title: 'Fine Waived',
        description: 'Successfully waived fine for theft case',
      });
      
      setShowFineDialog(false);
      setSelectedReport(null);
      
      // Refresh data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error waiving fine:', error);
      toast({
        title: 'Error',
        description: 'Failed to waive fine. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading theft reports...</div>;
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          Error loading theft reports: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📋 Theft Reports Management</h1>
          <p className="text-gray-600">Track and manage book theft incidents</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-red-50 text-red-700">
            {filteredReports.length} Total Reports
          </Badge>
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            {filteredReports.filter(r => r.status === 'reported').length} Active
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Thefts</p>
                <p className="text-3xl font-bold text-red-600">{theftReports.length}</p>
              </div>
              <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Cases</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {theftReports.filter(r => r.status === 'reported' || r.status === 'investigating').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Resolved</p>
                <p className="text-3xl font-bold text-green-600">
                  {theftReports.filter(r => r.status === 'resolved').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-3xl font-bold text-gray-900">
                  {theftReports.filter(r => {
                    const reportDate = new Date(r.reported_date);
                    const now = new Date();
                    return reportDate.getMonth() === now.getMonth() && 
                           reportDate.getFullYear() === now.getFullYear();
                  }).length}
                </p>
              </div>
              <div className="w-12 h-12 bg-gray-500 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search & Filter Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by student name, book title, or tracking codes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="reported">Reported</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theft Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            Theft Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Student</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Book</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Tracking Codes</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Reported Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.length > 0 ? (
                  filteredReports.map((report) => (
                    <tr key={report.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div>
                          <div className="font-medium text-gray-900">
                            {report.students?.first_name} {report.students?.last_name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {report.students?.admission_number} • {report.students?.class_grade}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-medium text-gray-900">{report.books?.title}</div>
                        <div className="text-sm text-gray-600">{report.books?.author}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Book Code: {report.books?.book_code}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-2">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Expected (Stolen):</div>
                            <Badge variant="outline" className="font-mono text-xs bg-red-50 text-red-700 border-red-200">
                              <Hash className="w-3 h-3 mr-1" />
                              {report.expected_tracking_code}
                            </Badge>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Returned:</div>
                            <Badge variant="outline" className="font-mono text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                              <Hash className="w-3 h-3 mr-1" />
                              {report.returned_tracking_code}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-700">
                        {format(new Date(report.reported_date), 'MMM dd, yyyy')}
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={`${getStatusColor(report.status)} flex items-center gap-1 w-fit`}>
                          {getStatusIcon(report.status)}
                          {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-blue-600 hover:text-blue-700"
                          >
                            View Details
                          </Button>
                          {report.status === 'reported' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-yellow-600 hover:text-yellow-700"
                            >
                              Investigate
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700 border-red-200"
                            onClick={() => {
                              setSelectedReport(report);
                              setCollectAmount(800); // Default theft fine
                              setShowFineDialog(true);
                            }}
                            disabled={report.status === 'resolved' || report.status === 'closed'}
                          >
                            <Currency className="w-3 h-3 mr-1" />
                            Collect Fine
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      {searchTerm || statusFilter !== 'all' 
                        ? "No theft reports found matching your criteria" 
                        : "No theft reports recorded yet"
                      }
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {filteredReports.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <Alert className="border-red-300 bg-red-100">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Important:</strong> Theft reports should be investigated promptly. 
                Contact students and verify circumstances before taking disciplinary action.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Fine Collection Dialog */}
      <Dialog open={showFineDialog} onOpenChange={setShowFineDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Currency className="h-5 w-5" />
              Collect Theft Fine
            </DialogTitle>
            <DialogDescription>
              Process fine collection for theft of library book
            </DialogDescription>
          </DialogHeader>
          
          {selectedReport && (
            <div className="space-y-4">
              <div className="bg-red-50 p-4 rounded-md border border-red-200">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold">Student:</span>
                    <span>{selectedReport.students?.first_name} {selectedReport.students?.last_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Admission:</span>
                    <span>{selectedReport.students?.admission_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Class:</span>
                    <span>{selectedReport.students?.class_grade}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Book:</span>
                    <span>{selectedReport.books?.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Tracking Code:</span>
                    <span className="font-mono text-xs">{selectedReport.expected_tracking_code}</span>
                  </div>
                  <div className="border-t border-red-200 mt-2 pt-2 flex justify-between">
                    <span className="font-semibold">Default Fine:</span>
                    <span className="font-bold">KES 800</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Amount to Collect (KES)
                </label>
                <Input
                  type="number"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(Number(e.target.value))}
                  className="w-full"
                  min={0}
                />
              </div>
              
              <DialogFooter className="flex justify-between items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleWaiveFine}
                  disabled={isProcessing}
                  className="text-gray-600"
                >
                  <X className="h-4 w-4 mr-1" />
                  Waive Fine
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowFineDialog(false)}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCollectFine}
                    disabled={isProcessing || collectAmount <= 0}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isProcessing ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Currency className="h-4 w-4 mr-1" />
                        Collect Fine
                      </>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
