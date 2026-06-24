/*
  # Fix resumes table: unique constraint on file_name, deduplicate rows

  1. Changes
    - Delete duplicate rows, keeping only the most recently modified row per file_name
    - Add unique constraint on file_name so upsert works correctly
*/

-- Keep only the latest row per file_name, delete older duplicates
DELETE FROM resumes
WHERE id NOT IN (
  SELECT DISTINCT ON (file_name) id
  FROM resumes
  ORDER BY file_name, last_modified DESC NULLS LAST
);

-- Add unique constraint on file_name
ALTER TABLE resumes
  ADD CONSTRAINT resumes_file_name_key UNIQUE (file_name);
