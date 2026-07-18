-- =============================================================================
-- Migration: 00014_notifications
-- Description: Adds a notifications table for user alerts
-- =============================================================================

CREATE TABLE notifications (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id  uuid        REFERENCES projects(id) ON DELETE CASCADE,
    type        text        NOT NULL, -- 'flagged', 'review_ready', etc.
    message     text        NOT NULL,
    link        text,       -- optional URL to navigate to when clicked
    is_read     boolean     DEFAULT false,
    created_at  timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "notifications: users can select own"
    ON notifications
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Users can update (mark as read) their own notifications
CREATE POLICY "notifications: users can update own"
    ON notifications
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Any authenticated user can insert a notification (e.g. reviewer flagging an image)
CREATE POLICY "notifications: users can insert"
    ON notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
