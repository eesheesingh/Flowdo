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
      };
    };
  };
};
