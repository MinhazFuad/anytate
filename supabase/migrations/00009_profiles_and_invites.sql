-- =============================================================================
-- Migration: 00002_profiles_and_invites
-- Description: Adds profiles and project_invites tables with RLS policies
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Table: profiles
-- One-to-one extension of auth.users storing public user data
-- -----------------------------------------------------------------------------
CREATE TABLE profiles (
    id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username    text        UNIQUE NOT NULL,
    created_at  timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Table: project_invites
-- Tracks invitations sent by project owners to collaborators
-- -----------------------------------------------------------------------------
CREATE TABLE project_invites (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    invited_email  text        NOT NULL,
    role           text        NOT NULL DEFAULT 'annotator', -- annotator | reviewer
    invited_by     uuid        REFERENCES auth.users(id),
    status         text        NOT NULL DEFAULT 'pending',   -- pending | accepted | rejected
    created_at     timestamptz DEFAULT now(),

    UNIQUE(project_id, invited_email)
);


-- -----------------------------------------------------------------------------
-- Enable Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invites ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- RLS Policies: profiles
-- -----------------------------------------------------------------------------

-- Any authenticated user can read any profile (e.g. to look up usernames)
CREATE POLICY "profiles: authenticated users can select"
    ON profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Users can only insert their own profile row
CREATE POLICY "profiles: users can insert own profile"
    ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

-- Users can only update their own profile row
CREATE POLICY "profiles: users can update own profile"
    ON profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());


-- -----------------------------------------------------------------------------
-- RLS Policies: project_invites
-- -----------------------------------------------------------------------------

-- Project owners can insert invites for their projects
CREATE POLICY "project_invites: owners can insert"
    ON project_invites
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM project_members
            WHERE project_members.project_id = project_invites.project_id
              AND project_members.user_id     = auth.uid()
              AND project_members.role        = 'owner'
        )
    );

-- Project owners can view all invites for their projects
CREATE POLICY "project_invites: owners can select"
    ON project_invites
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM project_members
            WHERE project_members.project_id = project_invites.project_id
              AND project_members.user_id     = auth.uid()
              AND project_members.role        = 'owner'
        )
    );

-- Invited users can view invites addressed to their own email
CREATE POLICY "project_invites: invited users can select own invites"
    ON project_invites
    FOR SELECT
    TO authenticated
    USING (
        invited_email = (
            SELECT email FROM auth.users WHERE id = auth.uid()
        )
    );

-- Invited users can update the status on invites addressed to their own email
CREATE POLICY "project_invites: invited users can update status"
    ON project_invites
    FOR UPDATE
    TO authenticated
    USING (
        invited_email = (
            SELECT email FROM auth.users WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        invited_email = (
            SELECT email FROM auth.users WHERE id = auth.uid()
        )
    );
