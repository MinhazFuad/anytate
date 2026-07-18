-- Add solo_mode to projects table for auto-approving annotations
alter table projects add column if not exists solo_mode boolean not null default false;
