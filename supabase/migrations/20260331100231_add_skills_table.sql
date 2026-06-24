/*
  # Add Skills Table

  ## Overview
  Adds a skills table to track technical skills found in resumes for better search and display.

  ## New Tables
  
  ### `skills`
  Stores skills extracted from resumes
  - `id` (uuid, primary key) - Unique identifier
  - `resume_id` (uuid, foreign key) - Reference to the resume
  - `skill_name` (text) - Name of the skill (e.g., Java, Python, AWS, Docker)
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - Enable RLS on skills table
  - Public read access for skills (consistent with resumes table)
  - Service can insert/update/delete skills

  ## Indexes
  - Index on skill_name for quick filtering
  - Index on resume_id for fast lookups
*/

-- Create skills table
CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(skill_name);
CREATE INDEX IF NOT EXISTS idx_skills_resume_id ON skills(resume_id);

-- Enable Row Level Security
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

-- RLS Policies for skills (public read for demo)
CREATE POLICY "Anyone can view skills"
  ON skills FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service can insert skills"
  ON skills FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Service can delete skills"
  ON skills FOR DELETE
  TO public
  USING (true);