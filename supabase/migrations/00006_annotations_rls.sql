-- 1. Update images (allow members to update image status)
create policy "Members can update images"
  on images for update
  using ( public.is_project_member(project_id) );

-- 2. Annotations
create policy "Members can read annotations"
  on annotations for select
  using (
    image_id in (
      select id from images where public.is_project_member(project_id)
    )
  );

create policy "Members can insert annotations"
  on annotations for insert
  with check (
    image_id in (
      select id from images where public.is_project_member(project_id)
    )
  );

create policy "Members can update annotations"
  on annotations for update
  using (
    image_id in (
      select id from images where public.is_project_member(project_id)
    )
  );

-- 3. Annotation history
create policy "Members can read annotation history"
  on annotation_history for select
  using (
    annotation_id in (
      select id from annotations where image_id in (
        select id from images where public.is_project_member(project_id)
      )
    )
  );

create policy "Members can insert annotation history"
  on annotation_history for insert
  with check (
    annotation_id in (
      select id from annotations where image_id in (
        select id from images where public.is_project_member(project_id)
      )
    )
  );

-- 4. Drafts
create policy "Members can read their own drafts"
  on drafts for select
  using ( user_id = auth.uid() );

create policy "Members can manage their own drafts"
  on drafts for all
  using ( user_id = auth.uid() );

-- Also fixing the images select/insert policies to use the safe public.is_project_member function
drop policy if exists "Members can read images" on images;
drop policy if exists "Members can insert images" on images;

create policy "Members can read images"
  on images for select
  using ( public.is_project_member(project_id) );

create policy "Members can insert images"
  on images for insert
  with check ( public.is_project_member(project_id) );
