-- Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  name text not null,
  drive_image_folder_id text not null,
  drive_output_folder_id text,          -- optional, for JSON-back-to-Drive sync
  coord_format text not null default 'ymin_xmin_ymax_xmax_0to1000',
  preprocessing jsonb not null default '{"max_dim": 1000, "jpeg_quality": 92}',
  created_at timestamptz default now()
);

-- Project Members (for role-based access)
create table project_members (
  project_id uuid references projects not null,
  user_id uuid references auth.users not null,
  role text not null default 'annotator', -- annotator | reviewer | owner
  primary key (project_id, user_id)
);

-- Drive Tokens (for storing Google Drive refresh tokens)
create table drive_tokens (
  user_id uuid references auth.users primary key,
  provider_refresh_token text not null,
  updated_at timestamptz default now()
);

-- Taxonomy versioning: a project can have many versions over time.
create table taxonomy_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects not null,
  version_number int not null,
  created_at timestamptz default now(),
  is_active boolean not null default true,
  unique (project_id, version_number)
);

-- Classes belong to a specific taxonomy version (immutable once created).
create table taxonomy_classes (
  id uuid primary key default gen_random_uuid(),
  taxonomy_version_id uuid references taxonomy_versions not null,
  class_key text not null,               
  display_name text not null,            
  color text not null,                   
  shortcut_key text,                     
  fcot jsonb not null,                   
  sort_order int not null default 0
);

-- Scene metadata schema
create table scene_metadata_field_sets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects not null,
  version_number int not null,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  unique (project_id, version_number)
);

create table scene_metadata_fields (
  id uuid primary key default gen_random_uuid(),
  field_set_id uuid references scene_metadata_field_sets not null,
  field_key text not null,               
  label text not null,                   
  field_type text not null,              
  options jsonb,                          
  persists_across_images boolean not null default true, 
  sort_order int not null default 0
);

-- Images 
create table images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects not null,
  drive_file_id text not null,
  file_name text not null,
  width int,
  height int,
  status text not null default 'pending', -- pending | done
  created_at timestamptz default now(),
  unique (project_id, drive_file_id)
);

-- Annotations
create table annotations (
  id uuid primary key default gen_random_uuid(),
  image_id uuid references images not null unique,
  taxonomy_version_id uuid references taxonomy_versions not null, 
  scene_metadata_field_set_id uuid references scene_metadata_field_sets not null, 
  grounded_instances jsonb not null default '[]', 
  scene_context jsonb not null default '{}', 
  derived_diagnostics jsonb not null default '{}', 
  total_objects int generated always as (jsonb_array_length(grounded_instances)) stored,
  annotator_id uuid references auth.users,
  status text not null default 'pending',      -- pending | approved | flagged
  reviewed_by uuid references auth.users,
  review_notes text,
  updated_at timestamptz default now()
);

-- Annotation History
create table annotation_history (
  id bigint generated always as identity primary key,
  annotation_id uuid references annotations not null,
  action_type text not null,        -- add_instance | remove_instance | edit_instance | edit_meta
  payload jsonb not null,           
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

-- Autosave drafts
create table drafts (
  id uuid primary key default gen_random_uuid(),
  image_id uuid references images not null,
  user_id uuid references auth.users not null,
  draft_state jsonb not null,       
  updated_at timestamptz default now(),
  unique (image_id, user_id)
);

-- RLS POLICIES

-- Enable RLS on all tables
alter table projects enable row level security;
alter table project_members enable row level security;
alter table drive_tokens enable row level security;
alter table taxonomy_versions enable row level security;
alter table taxonomy_classes enable row level security;
alter table scene_metadata_field_sets enable row level security;
alter table scene_metadata_fields enable row level security;
alter table images enable row level security;
alter table annotations enable row level security;
alter table annotation_history enable row level security;
alter table drafts enable row level security;

-- drive_tokens: Only the user can read/write their own token
create policy "Users can manage their own drive tokens"
  on drive_tokens for all
  using (user_id = auth.uid());

-- project_members: Users can read members of projects they belong to
create policy "Users can read members of their projects"
  on project_members for select
  using (project_id in (
    select project_id from project_members where user_id = auth.uid()
  ));

-- projects: Users can read/update projects they are a member of
create policy "Members can read projects"
  on projects for select
  using (
    id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "Owners can update projects"
  on projects for update
  using (
    id in (select project_id from project_members where user_id = auth.uid() and role = 'owner')
  );

-- projects: Any user can insert a project (and we'll add them as owner via a trigger or in code)
create policy "Users can create projects"
  on projects for insert
  with check (owner_id = auth.uid());

create policy "Users can insert themselves as owner"
  on project_members for insert
  with check (user_id = auth.uid() and role = 'owner');

-- (For simplicity in this initial script, we will omit the other detailed child table RLS policies
--  until we need them, but they follow the same join pattern against project_members).

-- taxonomy_versions
create policy "Members can read taxonomy versions"
  on taxonomy_versions for select
  using (project_id in (select project_id from project_members where user_id = auth.uid()));

create policy "Members can insert taxonomy versions"
  on taxonomy_versions for insert
  with check (project_id in (select project_id from project_members where user_id = auth.uid()));

create policy "Members can update taxonomy versions"
  on taxonomy_versions for update
  using (project_id in (select project_id from project_members where user_id = auth.uid()));

-- taxonomy_classes
create policy "Members can read taxonomy classes"
  on taxonomy_classes for select
  using (taxonomy_version_id in (
    select id from taxonomy_versions where project_id in (
      select project_id from project_members where user_id = auth.uid()
    )
  ));
  
create policy "Members can insert taxonomy classes"
  on taxonomy_classes for insert
  with check (taxonomy_version_id in (
    select id from taxonomy_versions where project_id in (
      select project_id from project_members where user_id = auth.uid()
    )
  ));

-- images
create policy "Members can read images"
  on images for select
  using (project_id in (select project_id from project_members where user_id = auth.uid()));
  
create policy "Members can insert images"
  on images for insert
  with check (project_id in (select project_id from project_members where user_id = auth.uid()));
