
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, User, Check, AlertCircle } from 'lucide-react';
import { 
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useStudents } from '@/hooks/useStudents';

interface StudentSelectorProps {
  value: any;
  onChange: (student: any) => void;
  disabled?: boolean;
}

export const StudentSelector: React.FC<StudentSelectorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const { data: studentsResponse, isLoading } = useStudents();
  
  // Extract students array safely
  const students = Array.isArray(studentsResponse?.students) ? studentsResponse.students : [];

  // Filter students based on search term
  const filteredStudents = students?.filter(student => {
    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
    const admissionNumber = student.admission_number?.toLowerCase() || '';
    const classGrade = student.class_grade?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();

    return fullName.includes(search) || 
           admissionNumber.includes(search) ||
           classGrade.includes(search);
  }) || [];

  // Pagination logic
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  const handleStudentSelect = (student: any) => {
    onChange(student);
    setIsSearching(false);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const clearSelection = () => {
    onChange(null);
    setSearchTerm('');
    setIsSearching(false);
    setCurrentPage(1);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setIsSearching(true);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (value && !isSearching) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">Selected Student</Label>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-medium text-green-900">
                    {value.first_name} {value.last_name}
                  </h4>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                      {value.admission_number}
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-300">
                      {value.class_grade}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                {!disabled && (
                  <button
                    onClick={clearSelection}
                    className="text-sm text-gray-600 hover:text-gray-900 underline"
                  >
                    Change
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium text-gray-700">Search and Select Student</Label>
        <div className="relative mt-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, admission number, or class..."
            className="pl-10"
            disabled={disabled || isLoading}
          />
        </div>
      </div>

      {isSearching && searchTerm && (
        <div className="border rounded-lg bg-white shadow-sm">
          {paginatedStudents.length > 0 ? (
            <>
              {/* Students List - Only showing current page */}
              <div className="space-y-1 p-2">
                {paginatedStudents.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => handleStudentSelect(student)}
                    className="p-3 border rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">
                          {student.first_name} {student.last_name}
                        </h4>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {student.admission_number}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {student.class_grade}
                          </Badge>
                          <Badge 
                            variant={student.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {student.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t bg-gray-50">
                  <div className="text-sm text-gray-600">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredStudents.length)} of {filteredStudents.length} students
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) handlePageChange(currentPage - 1);
                          }}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      
                      {/* First page */}
                      {currentPage > 2 && (
                        <>
                          <PaginationItem>
                            <PaginationLink 
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handlePageChange(1);
                              }}
                            >
                              1
                            </PaginationLink>
                          </PaginationItem>
                          {currentPage > 3 && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}
                        </>
                      )}
                      
                      {/* Current page and neighbors */}
                      {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                        const page = Math.max(1, Math.min(totalPages - 2, currentPage - 1)) + i;
                        if (page > totalPages) return null;
                        
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handlePageChange(page);
                              }}
                              isActive={currentPage === page}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      
                      {/* Last page */}
                      {currentPage < totalPages - 1 && (
                        <>
                          {currentPage < totalPages - 2 && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink 
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handlePageChange(totalPages);
                              }}
                            >
                              {totalPages}
                            </PaginationLink>
                          </PaginationItem>
                        </>
                      )}
                      
                      <PaginationItem>
                        <PaginationNext 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages) handlePageChange(currentPage + 1);
                          }}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>No students found matching "{searchTerm}"</p>
            </div>
          )}
        </div>
      )}

      {!isSearching && !value && (
        <div className="p-4 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">
          <User className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>Start typing to search for a student</p>
        </div>
      )}
    </div>
  );
};
