-- 1. scene_metadata_field_sets
create policy "Members can read scene field sets"
  on scene_metadata_field_sets for select
  using ( public.is_project_member(project_id) );

create policy "Members can insert scene field sets"
  on scene_metadata_field_sets for insert
  with check ( public.is_project_member(project_id) );

create policy "Members can update scene field sets"
  on scene_metadata_field_sets for update
  using ( public.is_project_member(project_id) );


-- 2. scene_metadata_fields
create policy "Members can read scene fields"
  on scene_metadata_fields for select
  using (
    field_set_id in (
      select id from scene_metadata_field_sets
      where public.is_project_member(project_id)
    )
  );

create policy "Members can insert scene fields"
  on scene_metadata_fields for insert
  with check (
    field_set_id in (
      select id from scene_metadata_field_sets
      where public.is_project_member(project_id)
    )
  );
