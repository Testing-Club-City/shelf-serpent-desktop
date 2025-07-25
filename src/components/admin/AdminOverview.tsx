import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  BookOpen, 
  FileText, 
  Calendar, 
  CheckCircle,
  Clock,
  DollarSign
} from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { formatCurrency } from '@/lib/utils';
import FineCollectionDialog from './FineCollectionDialog';

export const AdminOverview = () => {
  const { data: stats, isLoading } = useDashboardStats();
  const [showFineCollectionDialog, setShowFineCollectionDialog] = useState(false);

  const overviewCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'bg-blue-500'
    },
    {
      title: 'Active Classes',
      value: stats?.activeClasses || 0,
      icon: BookOpen,
      color: 'bg-green-500'
    },
    {
      title: 'Total Fines Collected',
      value: stats?.totalCollectedFines || 0,
      icon: DollarSign,
      color: 'bg-emerald-500'
    },
    {
      title: 'Active Borrowings',
      value: stats?.activeBorrowings || 0,
      icon: Calendar,
      color: 'bg-purple-500'
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-24 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {overviewCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="relative overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{card.title}</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {(card.title.toLowerCase().includes('fine') || card.title.toLowerCase().includes('payment') || card.title.toLowerCase().includes('amount') || card.title.toLowerCase().includes('money'))
                        ? formatCurrency(card.value)
                        : card.value}
                    </p>
                  </div>
                  <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3">
              <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <Users className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Add New User</p>
                    <p className="text-sm text-gray-600">Create librarian account</p>
                  </div>
                </div>
              </button>
              
              <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium">Manage Academic Terms</p>
                    <p className="text-sm text-gray-600">Configure school calendar</p>
                  </div>
                </div>
              </button>
              
              <button 
                className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setShowFineCollectionDialog(true)}
              >
                <div className="flex items-center space-x-3">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium">Fine Amount Collected</p>
                    <p className="text-sm text-gray-600">{formatCurrency(stats?.totalCollectedFines || 0)}</p>
                  </div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{stats?.activeBorrowings || 0}</p>
                <p className="text-sm text-gray-600">Active Borrowings</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{stats?.totalBooks || 0}</p>
                <p className="text-sm text-gray-600">Total Books</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">{stats?.overdueBorrowings || 0}</p>
                <p className="text-sm text-gray-600">Overdue Books</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Fine Collection Dialog */}
      <FineCollectionDialog 
        isOpen={showFineCollectionDialog} 
        onClose={() => setShowFineCollectionDialog(false)} 
        totalCollectedFines={stats?.totalCollectedFines || 0}
      />
    </div>
  );
};
