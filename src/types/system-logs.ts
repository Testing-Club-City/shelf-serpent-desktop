// Placeholder for system logs types
export interface LogSystemEventArgs {
  actionType: string;
  resourceType: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}
