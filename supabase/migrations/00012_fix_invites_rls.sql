-- Drop the faulty policies that try to select from auth.users
DROP POLICY IF EXISTS "project_invites: invited users can select own invites" ON project_invites;
DROP POLICY IF EXISTS "project_invites: invited users can update status" ON project_invites;

-- Recreate them using auth.jwt() ->> 'email' which does not require selecting from auth.users

-- Invited users can view invites addressed to their own email
CREATE POLICY "project_invites: invited users can select own invites"
    ON project_invites
    FOR SELECT
    TO authenticated
    USING (
        invited_email = (auth.jwt() ->> 'email')
    );

-- Invited users can update the status on invites addressed to their own email
CREATE POLICY "project_invites: invited users can update status"
    ON project_invites
    FOR UPDATE
    TO authenticated
    USING (
        invited_email = (auth.jwt() ->> 'email')
    )
    WITH CHECK (
        invited_email = (auth.jwt() ->> 'email')
    );
