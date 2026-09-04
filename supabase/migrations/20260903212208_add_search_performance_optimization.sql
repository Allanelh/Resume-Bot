/*
# Add Search Performance Optimization

## Overview
Dramatically improves resume search performance by enabling server-side
pre-filtering. Previously the frontend downloaded ALL resumes' full text
content (~38MB for 760 resumes) in 24+ paginated requests, plus all skills
and certifications, then ran 300+ regex patterns against each resume in
the browser. This migration adds a trigram index and a prefilter function
so the frontend only downloads resumes that match the search terms.

## Changes

1. Enables the pg_trgm extension for fast ILIKE pattern matching
2. Creates a GIN trigram index on resumes.content_text
   - This allows Postgres to use the trigram index for ILIKE queries
     instead of doing a full table scan
3. Creates the prefilter_resumes(text[]) function
   - Takes an array of lowercase search terms
   - Returns full resume rows where content_text ILIKE-matches any term
   - If the terms array is empty or NULL, returns all resumes (for "show all")
   - Uses OR logic: a resume passes if it matches ANY term

## Performance Impact
- "Bachelor's degree" search: 1 RPC call instead of 24 paginated requests
- "CISSP certification" search: returns ~30 resumes instead of 760
- Skills/certs fetched only for matching resume IDs, not all 760

## Security
- Function is callable by anon and authenticated roles (no-auth app)
- No SECURITY DEFINER needed — data is already publicly readable via RLS
- No new tables or columns
*/

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_resumes_content_trgm
  ON resumes USING gin(content_text gin_trgm_ops);

CREATE OR REPLACE FUNCTION prefilter_resumes(search_terms text[])
RETURNS TABLE(
  id uuid,
  file_name text,
  file_url text,
  drive_item_id text,
  content_text text,
  file_type text,
  last_modified timestamptz,
  indexed_at timestamptz,
  candidate_name text,
  created_at timestamptz
) AS $$
  SELECT
    r.id, r.file_name, r.file_url, r.drive_item_id,
    r.content_text, r.file_type, r.last_modified, r.indexed_at,
    r.candidate_name, r.created_at
  FROM resumes r
  WHERE search_terms IS NULL
     OR array_length(search_terms, 1) IS NULL
     OR EXISTS (
       SELECT 1 FROM unnest(search_terms) AS term
       WHERE r.content_text ILIKE '%' || term || '%'
     );
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION prefilter_resumes(text[]) TO anon, authenticated;
