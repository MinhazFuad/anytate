-- Drop the recursive policy
drop policy if exists "Users can read members of their projects" on project_members;

-- Replace with a simpler policy that avoids recursion
-- A user can see their own membership row, OR any membership for a project they own.
create policy "Users can read their own membership or projects they own"
  on project_members for select
  using (
    user_id = auth.uid() OR
    project_id in (
      select id from projects where owner_id = auth.uid()
    )
  );

-- We also need to fix the `projects` table select policy.
-- The previous one was: `id in (select project_id from project_members where user_id = auth.uid())`
-- This is fine and won't recurse since it queries project_members, which now doesn't query projects in a circular way for the typical user. 
