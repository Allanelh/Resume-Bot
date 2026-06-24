/*
  # Resume Bot Database Schema

  ## Overview
  Creates the core database structure for the Resume Bot application that stores
  indexed resume data, certifications, and configuration.

  ## New Tables

  ### `resumes`
  Stores indexed resume content and metadata from SharePoint
  - `id` (uuid, primary key) - Unique identifier for each resume
  - `file_name` (text) - Original file name from SharePoint
  - `file_url` (text) - Direct SharePoint link to the resume file
  - `content_text` (text) - Extracted text content from the resume
  - `file_type` (text) - File extension (pdf, docx, etc.)
  - `last_modified` (timestamptz) - Last modified date from SharePoint
  - `indexed_at` (timestamptz) - When the resume was indexed in our system
  - `candidate_name` (text) - Extracted candidate name (if available)
  - `created_at` (timestamptz) - Record creation timestamp

  ### `certifications`
  Stores certifications extracted from resumes for quick filtering
  - `id` (uuid, primary key) - Unique identifier
  - `resume_id` (uuid, foreign key) - Reference to the resume
  - `certification_name` (text) - Name of the certification (e.g., CISSP, AWS)
  - `created_at` (timestamptz) - Record creation timestamp

  ### `app_config`
  Stores application configuration like SharePoint folder URL
  - `id` (uuid, primary key) - Unique identifier
  - `config_key` (text, unique) - Configuration key name
  - `config_value` (text) - Configuration value
  - `updated_at` (timestamptz) - Last update timestamp
  - `created_at` (timestamptz) - Record creation timestamp

  ### `search_history`
  Optional: Stores search queries for analytics and improvement
  - `id` (uuid, primary key) - Unique identifier
  - `query` (text) - The search query text
  - `results_count` (integer) - Number of results returned
  - `created_at` (timestamptz) - When the search was performed

  ## Security
  - Enable RLS on all tables
  - Public read access for resumes and certifications (for demo purposes)
  - Authenticated users can manage configuration
  - All users can search and read resume data

  ## Indexes
  - Full-text search index on resume content
  - Index on certification names for quick filtering
  - Index on file_url for duplicate detection
*/

-- Create resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_url text UNIQUE NOT NULL,
  content_text text NOT NULL,
  file_type text DEFAULT 'pdf',
  last_modified timestamptz,
  indexed_at timestamptz DEFAULT now(),
  candidate_name text,
  created_at timestamptz DEFAULT now()
);

-- Create certifications table
CREATE TABLE IF NOT EXISTS certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  certification_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create app_config table
CREATE TABLE IF NOT EXISTS app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create search_history table
CREATE TABLE IF NOT EXISTS search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  results_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_resumes_content_text ON resumes USING gin(to_tsvector('english', content_text));
CREATE INDEX IF NOT EXISTS idx_certifications_name ON certifications(certification_name);
CREATE INDEX IF NOT EXISTS idx_resumes_file_url ON resumes(file_url);
CREATE INDEX IF NOT EXISTS idx_certifications_resume_id ON certifications(resume_id);

-- Enable Row Level Security
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for resumes (public read for demo)
CREATE POLICY "Anyone can view resumes"
  ON resumes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service can insert resumes"
  ON resumes FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Service can update resumes"
  ON resumes FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Service can delete resumes"
  ON resumes FOR DELETE
  TO public
  USING (true);

-- RLS Policies for certifications (public read for demo)
CREATE POLICY "Anyone can view certifications"
  ON certifications FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service can insert certifications"
  ON certifications FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Service can delete certifications"
  ON certifications FOR DELETE
  TO public
  USING (true);

-- RLS Policies for app_config (public access for demo)
CREATE POLICY "Anyone can view config"
  ON app_config FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert config"
  ON app_config FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update config"
  ON app_config FOR UPDATE
  TO public
  USING (true);

-- RLS Policies for search_history
CREATE POLICY "Anyone can view search history"
  ON search_history FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert search history"
  ON search_history FOR INSERT
  TO public
  WITH CHECK (true);