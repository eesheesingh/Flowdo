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
        // Required by @supabase/supabase-js's GenericTable constraint (Row & Insert &
        // Update & Relationships). We have no foreign-key relationships to describe yet.
        Relationships: [];
      };
    };
    // Views and Functions are required (even empty) to satisfy @supabase/supabase-js's
    // GenericSchema constraint (`Tables & Views & Functions`). Without all three —
    // including per-table `Relationships` above — SupabaseClient<Database, "flowdo">
    // can't resolve its Schema type parameter and silently falls back to `never` for
    // every table's Row/Insert/Update, which breaks `.from(...)` calls (surfaced by
    // Task 11's updateProfile, the first `.from()` use against the schema-typed client
    // rather than a `Pick<SupabaseClient, "auth">` one).
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
