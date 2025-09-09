import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Search, Eye, AlertTriangle, CheckCircle, XCircle, User, Book, Calendar, FileText, Users, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { generatePDFReport } from '@/utils/reportGenerator';

interface TheftReport {
  id: string;
  student_id: string;
  book_id: string;
  book_copy_id: string;
  borrowing_id: string;
  expected_tracking_code: string;
  returned_tracking_code: string;
  reported_date: string;
  resolved_date: string | null;
  status: string;
  theft_reason: string | null;
  investigation_notes: string | null;
  reported_by: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string | null;
  // Victim (student whose book was stolen)
  students: {
    id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
    class_grade: string;
    classes?: { class_name: string };
  };
  books: {
    id: string;
    title: string;
    author: string;
    book_code?: string;
  };
  book_copies?: {
    id: string;
    copy_number: number;
    tracking_code: string;
  };
  borrowings?: {
    id: string;
    issued_by: string | null;
    borrowed_date: string;
    // Perpetrator (student who stole the book)
    students?: {
      id: string;
      first_name: string;
      last_name: string;
      admission_number: string;
      class_grade: string;
    };
  };
  reported_by_profile?: {
    first_name: string;
    last_name: string;
  };
  resolved_by_profile?: {
    first_name: string;
    last_name: string;
  };
  // Theft fines
  theft_fines?: Array<{
    id: string;
    amount: number;
    fine_type: string;
    description: string;
    status: string;
  }>;
}

interface TheftReportsViewProps {
  onGeneratePDF?: () => void;
}

export const TheftReportsView: React.FC<TheftReportsViewProps> = ({ onGeneratePDF }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<TheftReport | null>(null);
  const { toast } = useToast();

  // Fetch theft reports with victim, perpetrator, and fine details
  const { data: theftReports = [], isLoading, refetch } = useQuery({
    queryKey: ['theft-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('theft_reports')
        .select(`
          *,
          students!theft_reports_student_id_fkey (
            id,
            first_name,
            last_name,
            admission_number,
            class_grade,
            classes (class_name)
          ),
          books (
            id,
            title,
            author,
            book_code
          ),
          book_copies (
            id,
            copy_number,
            tracking_code
          ),
          borrowings (
            id,
            issued_by,
            borrowed_date,
            students (
              id,
              first_name,
              last_name,
              admission_number,
              class_grade
            )
          ),
          reported_by_profile:profiles!theft_reports_reported_by_fkey (
            first_name,
            last_name
          ),
          resolved_by_profile:profiles!theft_reports_resolved_by_fkey (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching theft reports:', error);
        throw error;
      }

      // Fetch associated theft fines for each report
      const reportsWithFines = await Promise.all(
        (data || []).map(async (report) => {
          const { data: fines } = await supabase
            .from('fines')
            .select('id, amount, fine_type, description, status')
            .eq('student_id', report.borrowings?.students?.id || '')
            .eq('fine_type', 'theft');

          return {
            ...report,
            theft_fines: fines || []
          };
        })
      );

      return reportsWithFines as TheftReport[];
    },
  });

  // Filter reports based on search and status
  const filteredReports = theftReports.filter(report => {
    const victim = report.students;
    const perpetrator = report.borrowings?.students;
    
    const matchesSearch = !searchTerm || 
      victim?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      victim?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      victim?.admission_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perpetrator?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perpetrator?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perpetrator?.admission_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.books.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.expected_tracking_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.returned_tracking_code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Get status statistics
  const statusStats = {
    total: theftReports.length,
    reported: theftReports.filter(r => r.status === 'reported').length,
    investigating: theftReports.filter(r => r.status === 'investigating').length,
    resolved: theftReports.filter(r => r.status === 'resolved').length,
    closed: theftReports.filter(r => r.status === 'closed').length,
    totalFines: theftReports.reduce((sum, report) => 
      sum + (report.theft_fines?.reduce((fineSum, fine) => fineSum + fine.amount, 0) || 0), 0
    ),
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'reported':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Reported
        </Badge>;
      case 'investigating':
        return <Badge variant="secondary" className="flex items-center gap-1">
          <Search className="h-3 w-3" />
          Investigating
        </Badge>;
      case 'resolved':
        return <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Resolved
        </Badge>;
      case 'closed':
        return <Badge variant="outline" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Closed
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'reported':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'investigating':
        return <Search className="h-4 w-4 text-yellow-500" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'closed':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const handleGeneratePDF = () => {
    if (filteredReports.length === 0) {
      toast({
        title: 'No Data',
        description: 'No theft reports available to generate PDF',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Show loading toast
      toast({
        title: 'Generating Report',
        description: 'Preparing theft investigation report, please wait...',
      });

      // Use the standard PDF report generator with enhanced data
      const reportData = {
        theftReports: filteredReports,
        statusStats,
        generatedBy: 'Library Management System',
        generatedDate: new Date().toISOString(),
      };
      
      // Add a small delay to ensure the toast is shown before PDF generation starts
      setTimeout(() => {
        generatePDFReport(reportData, 'Official Theft Investigation Report', 'theft_reports');
        
        toast({
          title: 'Report Generated Successfully',
          description: `Official theft investigation report with ${filteredReports.length} case(s) is ready for printing`,
        });
      }, 300);
    } catch (error) {
      console.error('Error generating theft report:', error);
      toast({
        title: 'Report Generation Failed',
        description: 'Failed to generate the official theft investigation report. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading theft reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Professional Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-full">
            <Shield className="h-8 w-8 text-red-600" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Theft Investigation Center</h2>
            <p className="text-gray-600">Professional theft incident management and tracking system</p>
          </div>
        </div>
        <Button onClick={handleGeneratePDF} className="bg-red-600 hover:bg-red-700">
          <FileText className="h-4 w-4 mr-2" />
          Generate Official Report
        </Button>
      </div>

      {/* Enhanced Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Cases</p>
                <p className="text-2xl font-bold text-blue-600">{statusStats.total}</p>
              </div>
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-red-600">{statusStats.reported}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Investigating</p>
                <p className="text-2xl font-bold text-yellow-600">{statusStats.investigating}</p>
              </div>
              <Search className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Resolved</p>
                <p className="text-2xl font-bold text-green-600">{statusStats.resolved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-gray-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Closed</p>
                <p className="text-2xl font-bold text-gray-600">{statusStats.closed}</p>
              </div>
              <XCircle className="w-8 h-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Fines</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(statusStats.totalFines)}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Professional Search and Filter */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Investigation Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by victim, perpetrator, admission number, book title, or tracking codes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cases</SelectItem>
                  <SelectItem value="reported">Active</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Professional Cases List */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Investigation Cases ({filteredReports.length} of {theftReports.length})
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredReports.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-600 mb-2">No theft cases found</h3>
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search criteria' 
                  : 'No theft incidents have been reported yet'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="border-2 rounded-lg p-6 hover:shadow-lg transition-all cursor-pointer bg-white"
                  onClick={() => setSelectedReport(report)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(report.status)}
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900">
                          Case #{report.id.slice(0, 8).toUpperCase()}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Reported on {format(new Date(report.reported_date), 'PPP')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(report.status)}
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View Case
                      </Button>
                    </div>
                  </div>

                  {/* Professional Case Summary */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Victim Details */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        VICTIM (Book Owner)
                      </h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-medium">Name:</span> {report.students.first_name} {report.students.last_name}</p>
                        <p><span className="font-medium">Admission:</span> {report.students.admission_number}</p>
                        <p><span className="font-medium">Class:</span> {report.students.class_grade}</p>
                      </div>
                    </div>

                    {/* Perpetrator Details */}
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        PERPETRATOR (Book Thief)
                      </h4>
                      <div className="space-y-1 text-sm">
                        {report.borrowings?.students ? (
                          <>
                            <p><span className="font-medium">Name:</span> {report.borrowings.students.first_name} {report.borrowings.students.last_name}</p>
                            <p><span className="font-medium">Admission:</span> {report.borrowings.students.admission_number}</p>
                            <p><span className="font-medium">Class:</span> {report.borrowings.students.class_grade}</p>
                          </>
                        ) : (
                          <p className="text-red-600 italic">Under Investigation</p>
                        )}
                      </div>
                    </div>

                    {/* Book & Evidence */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <Book className="h-4 w-4" />
                        EVIDENCE
                      </h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-medium">Book:</span> {report.books.title}</p>
                        <p><span className="font-medium">Expected:</span> 
                          <code className="ml-1 bg-green-100 px-1 rounded text-xs">{report.expected_tracking_code}</code>
                        </p>
                        <p><span className="font-medium">Returned:</span> 
                          <code className="ml-1 bg-red-100 px-1 rounded text-xs">{report.returned_tracking_code}</code>
                        </p>
                        {report.theft_fines && report.theft_fines.length > 0 && (
                          <p><span className="font-medium">Fine:</span> 
                            <span className="text-red-600 font-semibold ml-1">
                              {formatCurrency(report.theft_fines.reduce((sum, fine) => sum + fine.amount, 0))}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Case Details Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Shield className="h-6 w-6 text-red-600" />
              Official Theft Investigation Report
            </DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-6">
              {/* Case Status Alert */}
              <Alert className={
                selectedReport.status === 'reported' ? 'border-red-200 bg-red-50' :
                selectedReport.status === 'investigating' ? 'border-yellow-200 bg-yellow-50' :
                selectedReport.status === 'resolved' ? 'border-green-200 bg-green-50' :
                'border-gray-200 bg-gray-50'
              }>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      Case #{selectedReport.id.slice(0, 8).toUpperCase()} - Status: {selectedReport.status.toUpperCase()}
                    </span>
                    {getStatusBadge(selectedReport.status)}
                  </div>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Victim Information */}
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg text-blue-700">
                      <User className="h-5 w-5" />
                      VICTIM INFORMATION
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="font-medium text-gray-900">Full Name:</p>
                          <p className="text-blue-700">{selectedReport.students.first_name} {selectedReport.students.last_name}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Admission Number:</p>
                          <p className="text-blue-700">{selectedReport.students.admission_number}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Class:</p>
                          <p className="text-blue-700">{selectedReport.students.class_grade}</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Status:</p>
                          <Badge variant="outline" className="text-blue-700 border-blue-300">Book Owner</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Perpetrator Information */}
                <Card className="border-l-4 border-l-red-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg text-red-700">
                      <Users className="h-5 w-5" />
                      PERPETRATOR INFORMATION
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      {selectedReport.borrowings?.students ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-medium text-gray-900">Full Name:</p>
                            <p className="text-red-700">{selectedReport.borrowings.students.first_name} {selectedReport.borrowings.students.last_name}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Admission Number:</p>
                            <p className="text-red-700">{selectedReport.borrowings.students.admission_number}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Class:</p>
                            <p className="text-red-700">{selectedReport.borrowings.students.class_grade}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Status:</p>
                            <Badge variant="destructive">Accused</Badge>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <AlertTriangle className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                          <p className="text-red-600 font-medium">UNDER INVESTIGATION</p>
                          <p className="text-sm text-gray-600">Perpetrator identification in progress</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Book Evidence */}
              <Card className="border-l-4 border-l-gray-500">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Book className="h-5 w-5" />
                    PHYSICAL EVIDENCE
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">Book Title:</p>
                        <p className="text-lg">{selectedReport.books.title}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Author:</p>
                        <p>{selectedReport.books.author}</p>
                      </div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">Expected Tracking Code:</p>
                        <code className="bg-green-100 px-3 py-1 rounded text-green-800 font-mono">
                          {selectedReport.expected_tracking_code}
                        </code>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Returned Tracking Code:</p>
                        <code className="bg-red-100 px-3 py-1 rounded text-red-800 font-mono">
                          {selectedReport.returned_tracking_code}
                        </code>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Case Timeline */}
              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5" />
                    INVESTIGATION TIMELINE
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <span className="font-medium">Incident Reported:</span>
                      <span>{format(new Date(selectedReport.reported_date), 'PPP HH:mm')}</span>
                    </div>
                    {selectedReport.reported_by_profile && (
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                        <span className="font-medium">Reported By:</span>
                        <span>{selectedReport.reported_by_profile.first_name} {selectedReport.reported_by_profile.last_name} (Librarian)</span>
                      </div>
                    )}
                    {selectedReport.resolved_date && (
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                        <span className="font-medium">Case Resolved:</span>
                        <span>{format(new Date(selectedReport.resolved_date), 'PPP HH:mm')}</span>
                      </div>
                    )}
                    {selectedReport.resolved_by_profile && (
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                        <span className="font-medium">Resolved By:</span>
                        <span>{selectedReport.resolved_by_profile.first_name} {selectedReport.resolved_by_profile.last_name}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Theft Fines Section */}
              {selectedReport.theft_fines && selectedReport.theft_fines.length > 0 && (
                <Card className="border-l-4 border-l-orange-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg text-orange-700">
                      <AlertCircle className="h-5 w-5" />
                      THEFT PENALTIES & FINES
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedReport.theft_fines.map((fine, index) => (
                        <div key={fine.id} className="flex items-center justify-between p-3 bg-orange-50 rounded border border-orange-200">
                          <div>
                            <p className="font-medium text-orange-900">{fine.description}</p>
                            <p className="text-sm text-orange-700">Type: {fine.fine_type}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-orange-800">{formatCurrency(fine.amount)}</p>
                            <Badge variant={fine.status === 'paid' ? 'default' : 'destructive'}>
                              {fine.status.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      <div className="border-t border-orange-200 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-semibold text-orange-900">Total Theft Fines:</span>
                          <span className="text-2xl font-bold text-orange-800">
                            {formatCurrency(selectedReport.theft_fines.reduce((sum, fine) => sum + fine.amount, 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Investigation Details */}
              {(selectedReport.theft_reason || selectedReport.investigation_notes) && (
                <Card className="border-l-4 border-l-indigo-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="h-5 w-5" />
                      INVESTIGATION NOTES
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {selectedReport.theft_reason && (
                        <div className="p-4 bg-indigo-50 rounded border border-indigo-200">
                          <p className="font-medium text-indigo-900 mb-2">Incident Reason:</p>
                          <p className="text-indigo-800">{selectedReport.theft_reason}</p>
                        </div>
                      )}
                      {selectedReport.investigation_notes && (
                        <div className="p-4 bg-gray-50 rounded border border-gray-200">
                          <p className="font-medium text-gray-900 mb-2">Investigation Notes:</p>
                          <p className="text-gray-800 whitespace-pre-wrap">{selectedReport.investigation_notes}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
