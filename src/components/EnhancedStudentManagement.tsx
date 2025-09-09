import React, { useState, useEffect } from 'react';
import { useStudentsWithClasses, useClassesWithStudents } from '@/hooks/useStudentsWithClasses';
import { useConnectivity } from '@/hooks/useConnectivity';
import { StudentWithClass } from '@/hooks/useStudentsWithClasses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, BookOpen, Wifi, WifiOff } from 'lucide-react';

interface EnhancedStudentManagementProps {
  onStudentSelect?: (student: StudentWithClass) => void;
  selectedStudents?: string[];
}

export const EnhancedStudentManagement: React.FC<EnhancedStudentManagementProps> = ({
  onStudentSelect,
  selectedStudents = []
}) => {
  const connectivity = useConnectivity();
  const [filters, setFilters] = useState({
    classGrade: '',
    status: '',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Use the enhanced hooks
  const {
    data: students = [],
    isLoading: studentsLoading,
    error: studentsError,
    refetch: refetchStudents
  } = useStudentsWithClasses({
    includeClasses: true,
    filters: {
      classGrade: filters.classGrade,
      status: filters.status,
      search: filters.search
    }
  });

  const {
    data: classes = [],
    isLoading: classesLoading,
    error: classesError,
    refetch: refetchClasses
  } = useClassesWithStudents();

  // Calculate pagination
  const totalStudents = students.length;
  const totalPages = Math.ceil(totalStudents / pageSize);
  const paginatedStudents = students.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Get unique class grades for filtering
  const uniqueClassGrades = [...new Set(classes.map(c => c.form_level.toString()))].sort();

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleRefresh = async () => {
    await Promise.all([refetchStudents(), refetchClasses()]);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'default';
      case 'graduated':
        return 'secondary';
      case 'transferred':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getClassBadge = (student: StudentWithClass) => {
    if (!student.class) {
      return <Badge variant="outline" className="text-muted-foreground">No Class</Badge>;
    }
    
    return (
      <Badge variant="default" className="bg-blue-100 text-blue-800">
        {student.class.class_name}
      </Badge>
    );
  };

  if (studentsLoading || classesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            Loading students and classes...
          </p>
        </div>
      </div>
    );
  }

  if (studentsError || classesError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <Users className="h-8 w-8 mx-auto" />
          </div>
          <p className="text-red-500 mb-4">
            Error loading student data
          </p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Student Management
          </h2>
          <p className="text-muted-foreground">
            Manage students with proper class associations
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm">
            {connectivity.isOnline ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-600">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-orange-500" />
                <span className="text-orange-600">Offline</span>
              </>
            )}
          </div>
          
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <Users className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Students
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">
              Across {classes.length} classes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Classes
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{classes.length}</div>
            <p className="text-xs text-muted-foreground">
              With student counts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Data Source
            </CardTitle>
            {connectivity.isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-orange-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {connectivity.isOnline ? 'Supabase' : 'Local SQLite'}
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time sync
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search students..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            
            <Select
              value={filters.classGrade}
              onValueChange={(value) => setFilters(prev => ({ ...prev, classGrade: value }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Classes</SelectItem>
                {uniqueClassGrades.map(grade => (
                  <SelectItem key={grade} value={grade}>
                    Form {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Students ({totalStudents} total)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {student.first_name} {student.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {student.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm">{student.admission_number}</code>
                    </TableCell>
                    <TableCell>
                      {getClassBadge(student)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(student.status)}>
                        {student.status || 'active'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onStudentSelect?.(student)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to{' '}
                {Math.min(currentPage * pageSize, totalStudents)} of {totalStudents} students
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
