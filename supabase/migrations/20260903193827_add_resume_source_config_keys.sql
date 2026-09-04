-- Add config keys for dual resume sources (New Candidates / Older Candidates)
-- The app_config table is a flexible key-value store, so no schema changes needed.
-- These keys track which source is active and store the "older candidates" folder URL.

INSERT INTO app_config (config_key, config_value)
VALUES ('active_resume_source', 'new')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO app_config (config_key, config_value)
VALUES ('sharepoint_folder_url_older', '')
ON CONFLICT (config_key) DO NOTHING;
