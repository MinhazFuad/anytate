-- Create a helper function that runs with admin privileges (security definer)
-- This allows us to check membership without triggering RLS recursively.
create or replace function auth.is_project_member(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from project_members
    where project_id = p_id and user_id = auth.uid()
  );
$$;

-- Drop all the old recursive policies
drop policy if exists "Members can read projects" on projects;
drop policy if exists "Owners can update projects" on projects;
drop policy if exists "Users can read their own membership or projects they own" on project_members;
drop policy if exists "Users can read members of their projects" on project_members;

-- 1. Projects
create policy "Members can read projects"
  on projects for select
  using ( owner_id = auth.uid() OR auth.is_project_member(id) );

create policy "Owners can update projects"
  on projects for update
  using ( owner_id = auth.uid() );

-- 2. Project Members
create policy "Users can read project members"
  on project_members for select
  using ( auth.is_project_member(project_id) );
