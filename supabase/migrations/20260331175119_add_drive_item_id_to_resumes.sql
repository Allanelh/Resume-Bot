/*
  # Add drive item ID to resumes table
  
  ## Changes
  - Add `drive_item_id` column to store the SharePoint drive item ID
  - This allows us to fetch fresh download URLs when needed
  
  ## Notes
  - The drive item ID is permanent, unlike download URLs which expire
  - Existing records will have NULL drive_item_id initially
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resumes' AND column_name = 'drive_item_id'
  ) THEN
    ALTER TABLE resumes ADD COLUMN drive_item_id text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_resumes_drive_item_id ON resumes(drive_item_id);
