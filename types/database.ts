export type Database = {
  flowdo: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["flowdo"]["Tables"]["profiles"]["Row"]> & { id: string; email: string };
        Update: Partial<Database["flowdo"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          parent_task_id: string | null;
          title: string;
          description: string | null;
          status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
          priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
          due_date: string | null;
          completed_at: string | null;
          position: number;
          created_at: string;
          updated_at: string;
          recurrence?: "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";
          recurrence_rule?: { interval: number; unit: "day" | "week" | "month" | "year" } | null;
        };
        Insert: Partial<Database["flowdo"]["Tables"]["tasks"]["Row"]> & { user_id: string; title: string };
        Update: Partial<Database["flowdo"]["Tables"]["tasks"]["Row"]>;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string;
          icon: string | null;
          owner_id: string;
          status: "ACTIVE" | "ARCHIVED";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["flowdo"]["Tables"]["projects"]["Row"]> & { owner_id: string; name: string };
        Update: Partial<Database["flowdo"]["Tables"]["projects"]["Row"]>;
        Relationships: [];
      };
      labels: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: Partial<Database["flowdo"]["Tables"]["labels"]["Row"]> & { user_id: string; name: string };
        Update: Partial<Database["flowdo"]["Tables"]["labels"]["Row"]>;
        Relationships: [];
      };
      task_labels: {
        Row: { task_id: string; label_id: string };
        Insert: { task_id: string; label_id: string };
        Update: Partial<{ task_id: string; label_id: string }>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          type: string;
          title: string;
          message: string | null;
          is_read: boolean;
          created_at: string;
          dedupe_key: string | null;
        };
        Insert: Partial<Database["flowdo"]["Tables"]["notifications"]["Row"]> & { user_id: string; type: string; title: string };
        Update: Partial<Database["flowdo"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          project_id: string | null;
          action: string;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Partial<Database["flowdo"]["Tables"]["activity_logs"]["Row"]> & { user_id: string; action: string };
        Update: Partial<Database["flowdo"]["Tables"]["activity_logs"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
