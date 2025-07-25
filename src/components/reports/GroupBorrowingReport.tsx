import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGroupBorrowings } from '@/hooks/useGroupBorrowings';
import { useStudents } from '@/hooks/useStudents';
import { useBooks } from '@/hooks/useBooks';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Users, BookOpen, Calendar, AlertCircle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface GroupBorrowingReportProps {
  selectedClass?: string;
}

export const GroupBorrowingReport: React.FC<GroupBorrowingReportProps> = ({ selectedClass = 'all' }) => {
  const { groupBorrowings, groupBorrowingsLoading: isLoadingBorrowings } = useGroupBorrowings();
  const { data: studentsResponse } = useStudents();
  const { data: books } = useBooks();
  
  // Extract students array safely
  const students = Array.isArray(studentsResponse?.students) ? studentsResponse.students : [];
  const [expandedBorrowing, setExpandedBorrowing] = useState<string | null>(null);

  if (isLoadingBorrowings) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading group borrowing data...</div>
      </div>
    );
  }

  if (!groupBorrowings?.length) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <div className="text-lg font-semibold">No Records Found</div>
            <div className="text-sm text-muted-foreground">No group borrowing records are available.</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter borrowings by class if needed
  const filteredBorrowings = selectedClass === 'all'
    ? groupBorrowings
    : groupBorrowings.filter(borrowing => {
        const studentIds = borrowing.student_ids || [];
        return studentIds.some(id => {
          const student = students?.find(s => s.id === id);
          return student?.class_id === selectedClass;
        });
      });

  // Calculate statistics
  const totalGroupBorrowings = filteredBorrowings.length;
  const activeBorrowings = filteredBorrowings.filter(b => b.status === 'active').length;
  const returnedBorrowings = filteredBorrowings.filter(b => b.status === 'returned').length;
  const totalStudentsInvolved = new Set(
    filteredBorrowings.flatMap(b => b.student_ids || [])
  ).size;
  const totalFines = filteredBorrowings.reduce((sum, b) => sum + (b.fine_amount || 0), 0);
  const averageGroupSize = filteredBorrowings.reduce((sum, b) => sum + b.student_count, 0) / totalGroupBorrowings;

  // Get student details for a borrowing
  const getStudentDetails = (studentIds: string[]) => {
    return studentIds.map(id => students?.find(s => s.id === id))
      .filter(student => student !== undefined)
      .sort((a, b) => a!.admission_number.localeCompare(b!.admission_number));
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-indigo-500" />
              <div className="text-sm font-medium text-muted-foreground">Total Borrowings</div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{totalGroupBorrowings}</div>
              <div className="text-xs text-muted-foreground">
                {activeBorrowings} active · {returnedBorrowings} returned
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-green-500" />
              <div className="text-sm font-medium text-muted-foreground">Students Involved</div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{totalStudentsInvolved}</div>
              <div className="text-xs text-muted-foreground">
                Avg. {averageGroupSize.toFixed(1)} per group
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              <div className="text-sm font-medium text-muted-foreground">Total Fines</div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">KSh {totalFines.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">
                From all group borrowings
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Borrowings List */}
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Group Borrowing Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {filteredBorrowings.map((borrowing) => {
              const book = books?.find(b => b.id === borrowing.book_id);
              const groupMembers = getStudentDetails(borrowing.student_ids || []);
              
              return (
                <AccordionItem key={borrowing.id} value={borrowing.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center space-x-4">
                        <div className="flex-1">
                          <div className="font-medium">{book?.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(borrowing.borrowed_date), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          borrowing.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {borrowing.status}
                        </span>
                        <div className="text-sm font-medium">
                          {borrowing.student_count} members
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-4 pt-4">
                      <div className="space-y-4">
                        {/* Borrowing Details */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="font-medium">Borrowed Date</div>
                            <div className="text-muted-foreground">
                              {format(new Date(borrowing.borrowed_date), 'MMMM d, yyyy')}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium">Due Date</div>
                            <div className="text-muted-foreground">
                              {format(new Date(borrowing.due_date), 'MMMM d, yyyy')}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium">Condition at Issue</div>
                            <div className="text-muted-foreground capitalize">
                              {borrowing.condition_at_issue}
                            </div>
                          </div>
                          {borrowing.status === 'returned' && (
                            <div>
                              <div className="font-medium">Condition at Return</div>
                              <div className="text-muted-foreground capitalize">
                                {borrowing.condition_at_return}
                              </div>
                            </div>
                          )}
                          {borrowing.fine_amount > 0 && (
                            <div>
                              <div className="font-medium">Fine Amount</div>
                              <div className="text-muted-foreground">
                                KSh {borrowing.fine_amount.toLocaleString()}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Group Members */}
                        <div>
                          <div className="font-medium mb-2">Group Members</div>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <table className="w-full">
                              <thead>
                                <tr className="text-sm text-muted-foreground">
                                  <th className="text-left py-2">Admission No.</th>
                                  <th className="text-left py-2">Name</th>
                                  <th className="text-left py-2">Class</th>
                                </tr>
                              </thead>
                              <tbody>
                                {groupMembers.map((student) => (
                                  <tr key={student!.id} className="text-sm">
                                    <td className="py-2">{student!.admission_number}</td>
                                    <td className="py-2">
                                      {student!.first_name} {student!.last_name}
                                    </td>
                                    <td className="py-2">{student!.class_grade}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Notes */}
                        {(borrowing.notes || borrowing.return_notes) && (
                          <div>
                            <div className="font-medium mb-2">Notes</div>
                            <div className="bg-gray-50 rounded-lg p-4 text-sm">
                              {borrowing.notes && (
                                <div className="mb-2">
                                  <div className="font-medium text-xs text-muted-foreground">Borrowing Notes</div>
                                  <div>{borrowing.notes}</div>
                                </div>
                              )}
                              {borrowing.return_notes && (
                                <div>
                                  <div className="font-medium text-xs text-muted-foreground">Return Notes</div>
                                  <div>{borrowing.return_notes}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}; 