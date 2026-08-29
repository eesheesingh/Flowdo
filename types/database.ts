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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
