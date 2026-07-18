-- Performance indexes for anytate
-- These make every filtered query faster as data grows.
-- All use IF NOT EXISTS so this is safe to run multiple times.

-- images: most queries filter by project_id + drive_folder_id + status
create index if not exists idx_images_project_id
  on images(project_id);

create index if not exists idx_images_project_folder_status
  on images(project_id, drive_folder_id, status);

-- annotations: review queue and dashboard filter by status
create index if not exists idx_annotations_status
  on annotations(status);

-- annotation_history: profile activity feed filters by created_by
create index if not exists idx_annotation_history_user
  on annotation_history(created_by, created_at desc);

-- project_invites: notification bell queries by invited_email + status on every tab focus
create index if not exists idx_project_invites_email_status
  on project_invites(invited_email, status);

-- taxonomy_versions: save route looks up active version per project
create index if not exists idx_taxonomy_versions_project_active
  on taxonomy_versions(project_id, is_active);

-- scene_metadata_field_sets: same as above
create index if not exists idx_scene_field_sets_project_active
  on scene_metadata_field_sets(project_id, is_active);

-- drafts: autosave lookups by image_id + user_id
create index if not exists idx_drafts_image_user
  on drafts(image_id, user_id);
