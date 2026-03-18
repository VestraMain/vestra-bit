export type ProjectStatus =
  | "draft"
  | "extracting"
  | "review"
  | "generating"
  | "complete"
  | "archived";

export interface Project {
  id: string;
  created_at: string;
  user_id: string;
  title: string;
  status: ProjectStatus;
  bid_deadline: string | null;
  source_url: string | null;
  extracted_data: Record<string, unknown> | null;
  source_files: string[] | null;
  output_files: Record<string, unknown> | null;
  social_copy: Record<string, unknown> | null;
  internal_notes: string | null;
  team_tips: Record<string, unknown> | null;
  client_contacts: Record<string, unknown> | null;
}

export type ProjectInsert = Omit<Project, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type ProjectUpdate = Partial<Omit<Project, "id" | "user_id">>;

export type Database = {
  // Supabase JS v2 requires this version marker
  __InternalPostgrestVersion: "12";
  public: {
    Tables: {
      projects: {
        Row: Project;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      project_status: ProjectStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
