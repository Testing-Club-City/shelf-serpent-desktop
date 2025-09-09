
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Search } from 'lucide-react';

export const SystemLogs: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const mockLogs = [
    {
      id: 1,
      timestamp: '2024-06-14 10:30:00',
      action: 'Book Borrowed',
      user: 'John Student',
      details: 'Borrowed "The Great Gatsby"',
      level: 'info'
    },
    {
      id: 2,
      timestamp: '2024-06-14 10:25:00',
      action: 'Book Returned',
      user: 'Jane Student',
      details: 'Returned "To Kill a Mockingbird"',
      level: 'info'
    },
    {
      id: 3,
      timestamp: '2024-06-14 10:20:00',
      action: 'User Login',
      user: 'Admin User',
      details: 'Admin logged into system',
      level: 'info'
    },
    {
      id: 4,
      timestamp: '2024-06-14 10:15:00',
      action: 'System Error',
      user: 'System',
      details: 'Failed to send notification',
      level: 'error'
    }
  ];

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'warning':
        return <Badge variant="secondary">Warning</Badge>;
      default:
        return <Badge variant="outline">Info</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            System Logs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">{log.timestamp}</TableCell>
                    <TableCell className="font-medium">{log.action}</TableCell>
                    <TableCell>{log.user}</TableCell>
                    <TableCell>{log.details}</TableCell>
                    <TableCell>{getLevelBadge(log.level)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
