import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const ReportsSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Class Filter */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-64" />
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="text-center">
                <Skeleton className="h-8 w-8 rounded-full mx-auto mb-2" />
                <Skeleton className="h-8 w-12 mx-auto mb-1" />
                <Skeleton className="h-4 w-20 mx-auto" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Report Generation */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-48" />
          </div>
        </CardContent>
      </Card>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-3/4 mb-3" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
              <Skeleton className="h-10 w-full mt-4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};