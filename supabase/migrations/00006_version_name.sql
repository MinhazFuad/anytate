-- Add version_name column to taxonomy_versions
ALTER TABLE taxonomy_versions ADD COLUMN IF NOT EXISTS version_name text;
