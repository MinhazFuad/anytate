-- =============================================================================
-- Migration: 00013_project_activity
-- Description: Adds a project_activity table to track generic project events
-- =============================================================================

CREATE TABLE project_activity (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     uuid        NOT NULL REFERENCES auth.users(id),
    action      text        NOT NULL, -- 'exported_dataset', 'updated_taxonomy', 'updated_scene_metadata', etc.
    details     text,
    created_at  timestamptz DEFAULT now()
);

ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;

-- Members can view project activity
CREATE POLICY "project_activity: members can select"
    ON project_activity
    FOR SELECT
    TO authenticated
    USING (
        project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );

-- Any authenticated user can insert activity (the API handles specific role checks)
-- Wait, actually only members should insert
CREATE POLICY "project_activity: members can insert"
    ON project_activity
    FOR INSERT
    TO authenticated
    WITH CHECK (
        project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
        )
    );
