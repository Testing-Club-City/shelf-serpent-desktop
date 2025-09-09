export interface RpcFunctions {
  Tables: {};
  Views: {};
  Functions: {
    log_system_event: {
      Args: {
        p_action: string;
        p_description: string;
        p_severity: 'info' | 'warning' | 'error' | 'success';
        p_component: string;
        p_metadata?: Record<string, any>;
      };
      Returns: string;
    };
    clean_duplicate_logs: {
      Args: Record<string, never>;
      Returns: void;
    };
  };
  Enums: {};
} 