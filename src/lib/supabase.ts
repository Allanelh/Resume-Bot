import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Resume {
  id: string;
  file_name: string;
  file_url: string;
  drive_item_id: string | null;
  content_text: string;
  file_type: string;
  last_modified: string | null;
  indexed_at: string;
  candidate_name: string | null;
  created_at: string;
}

export interface Certification {
  id: string;
  resume_id: string;
  certification_name: string;
  created_at: string;
}

export interface Skill {
  id: string;
  resume_id: string;
  skill_name: string;
  created_at: string;
}

export interface AppConfig {
  id: string;
  config_key: string;
  config_value: string;
  updated_at: string;
  created_at: string;
}

export interface MatchReason {
  type: 'degree' | 'field' | 'cert' | 'experience' | 'seniority' | 'role' | 'institution' | 'clearance' | 'skill' | 'other';
  label: string;
}

export interface SearchResult extends Resume {
  certifications: string[];
  skills: string[];
  matchedSnippets: string[];
  matchReason: string;
  matchReasons?: MatchReason[];
}

export interface SearchMetrics {
  totalResumes: number;
  searchTimeSeconds: number;
}
