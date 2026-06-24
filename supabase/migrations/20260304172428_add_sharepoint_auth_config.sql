/*
  # Add SharePoint Authentication Configuration

  1. New Columns
    - Add `sharepoint_access_token` column to store encrypted OAuth token
    - Add `sharepoint_refresh_token` for token refresh
    - Add `token_expires_at` for token expiration tracking

  2. Security
    - Tokens are stored for server-side use only
    - Row level security prevents unauthorized access
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_config' AND column_name = 'sharepoint_access_token'
  ) THEN
    ALTER TABLE app_config ADD COLUMN sharepoint_access_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_config' AND column_name = 'sharepoint_refresh_token'
  ) THEN
    ALTER TABLE app_config ADD COLUMN sharepoint_refresh_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_config' AND column_name = 'token_expires_at'
  ) THEN
    ALTER TABLE app_config ADD COLUMN token_expires_at timestamptz;
  END IF;
END $$;
