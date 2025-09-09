import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Users, 
  Search, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  BookOpen,
  GraduationCap,
  X,
  Loader2
} from 'lucide-react';
import { useStudentsOffline } from '@/hooks/useStudentsOffline';
import { format } from 'date-fns';

interface GroupStudentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  studentIds: string[] | string;
  groupBorrowingId: string;
  bookTitle?: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_grade: string;
  email?: string;
  phone?: string;
  address?: string;
  created_at: string;
  status?: string;
}

export const GroupStudentsDialog = ({ 
  isOpen, 
  onClose, 
  studentIds, 
  groupBorrowingId,
  bookTitle 
}: GroupStudentsDialogProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [groupStudents, setGroupStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { data: allStudents, isLoading: studentsLoading } = useStudentsOffline();

  // Filter students based on the provided student IDs
  useEffect(() => {
    if (allStudents && studentIds.length > 0) {
      setLoading(true);
      
      // Parse student IDs from JSON string if needed
      let parsedStudentIds: string[] = [];
      
      if (typeof studentIds === 'string') {
        try {
          parsedStudentIds = JSON.parse(studentIds);
        } catch {
          // If it's not JSON, treat as comma-separated string
          parsedStudentIds = studentIds.split(',').map(id => id.trim());
        }
      } else if (Array.isArray(studentIds)) {
        parsedStudentIds = studentIds;
      }

      // Find students that match the IDs
      const matchedStudents = allStudents.filter(student => 
        parsedStudentIds.includes(student.id)
      ) as Student[];
      
      setGroupStudents(matchedStudents);
      setLoading(false);
    }
  }, [allStudents, studentIds]);

  // Filter students based on search query
  const filteredStudents = groupStudents.filter(student => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      student.first_name?.toLowerCase().includes(query) ||
      student.last_name?.toLowerCase().includes(query) ||
      student.admission_number?.toLowerCase().includes(query) ||
      student.class_grade?.toLowerCase().includes(query) ||
      student.email?.toLowerCase().includes(query)
    );
  });

  // Get student initials for avatar
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  // Get status color
  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'inactive':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                Group Students Details
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {bookTitle && (
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-4 h-4" />
                    Book: {bookTitle}
                  </span>
                )}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Search and Stats */}
        <div className="flex-shrink-0 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                <Users className="w-3 h-3 mr-1" />
                {groupStudents.length} Students
              </Badge>
              <Badge variant="outline">
                Group ID: {groupBorrowingId.slice(-8)}
              </Badge>
            </div>
            
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search students by name, admission number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Students List */}
        <div className="flex-1 overflow-y-auto">
          {loading || studentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading students...
              </div>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? 'No students found' : 'No students in this group'}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery 
                  ? 'Try adjusting your search criteria'
                  : 'This group appears to have no students assigned'
                }
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredStudents.map((student) => (
                <Card key={student.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <Avatar className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500">
                        <AvatarFallback className="bg-transparent text-white font-semibold">
                          {getInitials(student.first_name, student.last_name)}
                        </AvatarFallback>
                      </Avatar>

                      {/* Student Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-lg leading-tight">
                              {student.first_name} {student.last_name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {student.admission_number}
                            </p>
                          </div>
                          {student.status && (
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getStatusColor(student.status)}`}
                            >
                              {student.status}
                            </Badge>
                          )}
                        </div>

                        {/* Details Grid */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <GraduationCap className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">Class:</span>
                            <span>{student.class_grade}</span>
                          </div>

                          {student.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">Email:</span>
                              <span className="truncate">{student.email}</span>
                            </div>
                          )}

                          {student.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">Phone:</span>
                              <span>{student.phone}</span>
                            </div>
                          )}

                          {student.address && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">Address:</span>
                              <span className="truncate">{student.address}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">Enrolled:</span>
                            <span>
                              {format(new Date(student.created_at), 'MMM dd, yyyy')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {filteredStudents.length} of {groupStudents.length} students
            </div>
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};