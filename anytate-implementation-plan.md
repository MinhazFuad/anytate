# Anytate — General-Purpose FCOT Annotation Web App — Implementation Plan

**Handoff document for build.** This spec assumes the reader (human or AI) has no prior conversation history with the people who wrote it — it should be understandable on its own. It is meant to be handed over together with the original `human_annotation_final_fix4.ipynb` (referenced throughout as "the original notebook" / "the old tool"), which remains the authoritative source for exact implementation details this plan describes at a spec level rather than reproduces line-for-line: the canvas drawing/keyboard-shortcut JS, the exact FCOT field names and taxonomy content, and the image resize math.

Anytate replaces that Colab-notebook-based FCOT bounding-box annotation tool (originally hardcoded for water-surface-debris detection) with a **domain-agnostic**, multi-user web app: users define their own classes, their own FCOT reasoning schema, and their own scene-level metadata fields per project — the water-debris taxonomy becomes just one example/seed dataset, not a built-in assumption. Keeps Google Drive as the image source of truth (no Supabase Storage) and adds: user-defined taxonomies with versioning, user-defined scene metadata schemas, full undo/redo, a progress dashboard, review/QA workflow, COCO/YOLO export, configurable preprocessing, and autosaving drafts.

---

## 1. Goals & Non-Goals

**Goals**
- Web-based replacement for the Colab tool, deployed on Vercel.
- Images stay in the user's Google Drive (read via Drive API) — no image storage cost.
- Annotation metadata, taxonomy, and app state live in Postgres (Supabase), which is cheap and queryable (needed for the dashboard, QA, and export features).
- Users define their own class taxonomy (FCOT structure) per project, via a form or JSON import.
- Users define their own scene-level metadata schema per project (the old tool's lighting/water-body/turbidity fields were hardcoded — Anytate makes that pattern generic, so a project annotating retail shelf photos, satellite imagery, or medical scans doesn't inherit water-specific fields).
- Preserve the original output contract: each saved annotation instance still embeds a full FCOT block, not just a class name.
- No domain assumptions anywhere in the schema or UI copy — "water-surface debris" becomes one example seed project among any number of others.

**Non-Goals (for v1)**
- No image storage migration — Drive stays authoritative for pixels.
- No real-time multi-cursor collaboration (can be a v2 addition via Supabase Realtime).
- No mobile-optimized canvas (desktop-first, like the original tool).

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js 14+ (App Router), React, TypeScript | Vercel-native, file-based routing, server components for data-heavy pages (dashboard) |
| Styling | Tailwind CSS + CSS variables for theming | Fast iteration, easy dark/light theme via variables |
| Dark/light toggle | `next-themes` | Handles `class` strategy, persists to localStorage, no flash-of-wrong-theme |
| Database | Supabase Postgres | Free/cheap tier, RLS for multi-tenant security, JSONB for FCOT blobs |
| Auth | Supabase Auth, Google OAuth provider | Same Google login can request Drive API scopes — one login for both app auth and Drive access |
| Image source | Google Drive API v3 (client-side + server-side via stored refresh token) | User's own Drive stays the image store, per original tool |
| Charts (dashboard) | Recharts | Already available, simple declarative API |
| Client-side zip (export) | JSZip | Bundle per-image JSON / COCO / YOLO files for download |
| Form validation | Zod | Validate taxonomy JSON imports and forms with one schema source of truth |
| State (undo/redo) | Custom reducer w/ past/present/future stacks (or `use-undo` / `zundo` middleware on Zustand) | Standard "command history" pattern |
| Hosting | Vercel (Hobby/free tier, see §4.4) | Matches your requirement — Hobby is $0, but has hard caps (no overage billing) that shape a few decisions below |

---

## 3. High-Level Architecture

```
┌─────────────┐      OAuth (Google)       ┌──────────────────┐
│   Browser    │◄─────────────────────────►│  Supabase Auth    │
│  (Next.js)   │                            └──────────────────┘
│              │      Drive API calls       ┌──────────────────┐
│  Canvas UI   │◄─────────────────────────►│  Google Drive API │
│  Dashboard   │      (image bytes,         │  (user's own      │
│  Taxonomy    │       list folder)         │   Drive)          │
│  builder     │                            └──────────────────┘
│              │      Postgres queries       ┌──────────────────┐
│              │◄─────────────────────────►│  Supabase Postgres │
└─────────────┘      (via supabase-js)      │  (annotations,     │
       │                                     │   taxonomy, drafts,│
       │  Vercel API routes (server-side)    │   review, history) │
       └────────────────────────────────────►└──────────────────┘
              (export generation, Drive
               token refresh, COCO/YOLO
               transforms)
```

Images never touch your server or Supabase — the browser fetches image bytes directly from Drive using the user's access token (Drive API `files.get?alt=media`), draws them to canvas, and only the bounding boxes / JSON go to Postgres.

---

## 4. Google Drive Integration

### 4.1 Auth & scopes
- Configure Supabase Auth's Google provider with additional OAuth scopes:
  `https://www.googleapis.com/auth/drive.readonly` (read images) and, if you want the app to also write JSON back into a Drive folder for compatibility with the old workflow, `https://www.googleapis.com/auth/drive.file`.
- **Google does not return a refresh token by default.** Without one, the Drive integration will work at login and then silently break about an hour later when the access token expires. The `signInWithOAuth()` call must explicitly request one:
  ```ts
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/drive.readonly',
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  ```
  `access_type: 'offline'` tells Google to issue a refresh token at all; `prompt: 'consent'` forces the consent screen (and a fresh refresh token) even for returning users who already granted access, which matters because Google otherwise only issues a refresh token on a user's *first* consent.
- Supabase stores the `provider_token` and `provider_refresh_token` on sign-in. Because these expire, persist the refresh token server-side (a `drive_tokens` table, encrypted at rest via Supabase Vault or just relying on RLS + Postgres column encryption) and refresh via a Vercel API route (`/api/drive/refresh`) using Google's OAuth token endpoint.
- Google Cloud Console setup: create a project, enable "Google Drive API," configure OAuth consent screen (scopes above), create OAuth client credentials, add them to Supabase Auth provider settings, add your Vercel domain to authorized redirect URIs.

### 4.2 Reading images
- User pastes/selects a Drive folder (folder ID or a Drive picker widget — Google's [Picker API](https://developers.google.com/drive/picker/guides/overview) is the easiest "minimal hassle" option: it gives a native folder browser without you building one).
- On project creation, call `files.list` with `q: "'<folderId>' in parents and (mimeType contains 'image/')"` to enumerate images. Store `drive_file_id`, `name`, `mimeType` in the `images` table (not the bytes).
- Apply the same natural-sort (`p_img_1, p_img_2, ..., p_img_10`) client-side or in a Postgres function, matching the notebook's `_natural_key`.
- **Fetch image bytes directly from the browser — do not proxy through a Vercel API route.** Vercel's Fast Origin Transfer meter (data leaving a Vercel function) is billed from the first byte with no included allowance (~$0.06/GB as of mid-2026), on top of the Fast Data Transfer meter — routing every full-resolution image through a serverless function on every load adds real, avoidable cost for an image-heavy annotation tool, and buys little: the token is scoped to `drive.readonly` (or `drive.file`), so a leak only exposes read access to the images already being annotated in the browser, not write/delete access or unrelated Drive contents. Call `https://www.googleapis.com/drive/v3/files/{fileId}?alt=media` with the user's access token directly from the browser.

### 4.3 Writing JSON back to Drive (optional, for continuity)
- If you want Drive to also hold a copy of each image's JSON (so the tool "feels" like the original), add a background sync: on save, in addition to writing to Postgres, call Drive's `files.create`/`files.update` to write `{stem}.json` into a configured output folder. This is optional — Postgres is the real source of truth for the dashboard/QA/export features, since Drive JSON files are not queryable.

### 4.4 Vercel Hobby (free) plan constraints
This project is being deployed on Vercel's **Hobby** plan, not Pro. That changes a few things — Hobby has hard caps with no overage billing, meaning the app stops serving (not "charges more") once a limit is hit for the month:

| Limit | Hobby cap | Relevance here |
|---|---|---|
| Fast Data Transfer | 100 GB/month | The direct-from-browser Drive fetch pattern in §4.2 is what makes this workable at all — image bytes never touch Vercel's network, so this cap is only consumed by your actual app pages/API responses, not image traffic. |
| Function invocations | 1M/month | Fine for normal use; watch the autosave-draft debounce interval (§12) — too aggressive a debounce could multiply invocations if drafts are written via an API route rather than directly via the Supabase client. |
| Active CPU | 4 hours/month | The tightest cap for this app. Export generation (§10) is the main CPU-heavy operation — see below. |
| Terms of use | **Personal, non-commercial projects only** | If Anytate is ever used by other people/teams beyond you personally, or monetized, Hobby's terms are violated and Vercel can suspend the deployment — this isn't just a soft recommendation to upgrade, it's a ToS boundary. Budget for Pro ($20/seat/month) before inviting outside users (relevant once `project_members`, §5, is actually used by a second real person). |

**Design implications:**
- Keep Drive fetches client-side (§4.2) — non-negotiable on Hobby, since 100 GB disappears fast if image bytes ever route through a function.
- **Export generation (§10) is the operation most likely to blow the Active CPU budget**, especially COCO/YOLO transforms plus JSZip bundling over a large project run inside a single serverless invocation. Mitigate by: doing the JSON transform (COCO/YOLO coordinate math) server-side since it's cheap and fast, but doing the actual zipping client-side with JSZip after the API route streams back the transformed JSON array — keeps the expensive/slow part (compression of potentially many files) off Vercel's CPU meter entirely and off the clock for function timeout limits too.
- Function timeouts are also shorter on Hobby than Pro — don't design any single API route (export, Drive token refresh) to do unbounded-size work in one call; page/paginate large exports if a project has thousands of images.
- If usage grows past personal use, the migration path is just flipping to Pro (§17 in the original review already assumed Pro numbers) — nothing else in this architecture needs to change, only the plan tier.

---

## 5. Database Schema (Supabase Postgres)

All tables use `uuid` PKs and RLS policies scoped to `auth.uid()`. Below is the core DDL.

```sql
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
  class_key text not null,               -- project-defined, e.g. "plastic_bottle" for a debris project or "cell_nucleus" for a microscopy project
  display_name text not null,            -- e.g. "🥤 Plastic Bottle" — purely user-authored, no domain baked in
  color text not null,                   -- hex
  shortcut_key text,                     -- "1".."9","0","o"
  fcot jsonb not null,                   -- {Primary Cue, Observation, Contrastive Rules[], ...}
  sort_order int not null default 0
);

-- Scene metadata schema: the generic replacement for the old tool's hardcoded
-- lighting/water_body_type/turbidity fields. Each project defines its own
-- image-level (not per-instance) metadata fields — e.g. a debris project
-- might define "lighting" and "turbidity_score"; a retail-shelf project
-- might define "store_region" and "shelf_type"; a medical-imaging project
-- might define "modality" and "patient_view_angle". Same versioning pattern
-- as taxonomy_classes, for the same reason (old annotations must keep the
-- field definitions that were active when they were saved).
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
  field_key text not null,               -- e.g. "lighting", "store_region"
  label text not null,                   -- display label
  field_type text not null,              -- 'select' | 'text' | 'number' | 'slider' | 'textarea'
  options jsonb,                          -- for 'select'/'slider': [{value, label}] or {min,max,step}
  persists_across_images boolean not null default true, -- carry value forward image-to-image, like the old tool's lighting/water-body persistence
  sort_order int not null default 0
);

-- Images (metadata only — bytes stay in Drive)
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

-- Annotations: one row per image (current/latest state).
create table annotations (
  id uuid primary key default gen_random_uuid(),
  image_id uuid references images not null unique,
  taxonomy_version_id uuid references taxonomy_versions not null, -- version used at save time
  scene_metadata_field_set_id uuid references scene_metadata_field_sets not null, -- field-set version used at save time
  grounded_instances jsonb not null default '[]', -- [{instance_id, object_name, bbox_2d, fcot}]
  scene_context jsonb not null default '{}', -- keyed by field_key from scene_metadata_fields, values only — no hardcoded water fields
  derived_diagnostics jsonb not null default '{}', -- project-defined derived/summary values (e.g. "primary_class" = most common object_name in this image; project can define others)
  total_objects int generated always as (jsonb_array_length(grounded_instances)) stored,
  annotator_id uuid references auth.users,
  status text not null default 'pending',      -- pending | approved | flagged
  reviewed_by uuid references auth.users,
  review_notes text,
  updated_at timestamptz default now()
);

-- Full undo/redo + audit trail: every mutating action on an image's annotation
-- is appended here. The reducer replays/reverts against this log client-side,
-- and it doubles as an audit trail for QA.
create table annotation_history (
  id bigint generated always as identity primary key,
  annotation_id uuid references annotations not null,
  action_type text not null,        -- add_instance | remove_instance | edit_instance | edit_meta
  payload jsonb not null,           -- the diff needed to apply/revert
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

-- Autosave drafts: debounced writes of in-progress (unsaved) box state,
-- separate from the committed `annotations` row.
create table drafts (
  id uuid primary key default gen_random_uuid(),
  image_id uuid references images not null,
  user_id uuid references auth.users not null,
  draft_state jsonb not null,       -- same shape as grounded_instances + meta
  updated_at timestamptz default now(),
  unique (image_id, user_id)
);
```

**Row Level Security**: every table gets a policy like
```sql
alter table projects enable row level security;
create policy "owner access" on projects
  for all using (owner_id = auth.uid());
```
and for child tables, a policy that joins back to `projects.owner_id = auth.uid()` (or a `project_members` table if you want multi-user projects with reviewer roles — recommended, see §8).

For multi-user projects (needed for the Review/QA feature), add:
```sql
create table project_members (
  project_id uuid references projects not null,
  user_id uuid references auth.users not null,
  role text not null default 'annotator', -- annotator | reviewer | owner
  primary key (project_id, user_id)
);
```
and update RLS policies to check membership instead of just `owner_id`.

### 5.1 Server-side validation before writes (do not trust the client)
`grounded_instances` and the other JSONB columns are stored schema-flexibly, but that flexibility must not extend to what's allowed to reach the database unvalidated. A client-side bug — especially in the undo/redo reducer (§7.1), where an action is applied/reverted from a stack — can produce a malformed `grounded_instances` array (a box missing its `fcot` block, a stale `class_key` that no longer exists in the active taxonomy version, an out-of-range coordinate) and write it straight to Postgres if nothing stops it.
- Every write to `annotations` (save, autosave-draft-promotion, review edit) must go through a Next.js Server Action (or API route) that re-validates the full payload against a Zod schema mirroring the taxonomy's FCOT shape and the `scene_metadata_fields` definitions **before** the Supabase `UPDATE`/`UPSERT` is issued — never let the canvas UI's `UPDATE` calls hit Supabase directly for this table.
- The Zod schema should check structural shape (required FCOT fields present, `bbox_2d` is 4 numbers in the 0–1000 range) and, where feasible, referential validity (`object_name`/`class_key` exists in the annotation's `taxonomy_version_id`).
- On validation failure, reject the write and surface a specific error to the UI (which field/instance failed) rather than silently dropping the corrupted instance or accepting a partial array — corrupted FCOT data is worse than a rejected save, since it pollutes exports and the dashboard silently.
- This applies to `drafts` too, though more leniently — a draft can be a syntactically valid but semantically incomplete `grounded_instances` array during editing; only the final promotion into `annotations` needs full FCOT-completeness enforced.

---

## 6. Taxonomy Builder

### 6.1 Data model
Each edit to a taxonomy creates a **new `taxonomy_versions` row**, not a mutation of the old one. `taxonomy_classes` rows are immutable once created and belong to exactly one version. This is what gives you versioning "for free": an `annotations` row references the `taxonomy_version_id` that was active when it was saved, so the FCOT text an old annotation shows never changes even if the user edits the taxonomy tomorrow. (This also matches what the original notebook already did by copying the whole `fcot` dict into each saved instance — you're just formalizing it with a foreign key instead of only relying on the embedded copy.)

### 6.2 UI — two entry paths
1. **Guided form** (default): "Add Class" opens a stepper/accordion with fields matching the FCOT schema:
   `Primary Cue`, `Observation`, `Contrastive Rules` (repeatable text list), `Static-Frame Disambiguation`, `Decision Rule`, `Fallback Rule`, `Failure Mode`, `Instance Note`, `Conclusion`, plus `display_name`, `color` (color picker), auto-assigned `shortcut_key`.
2. **Paste JSON** (advanced): a textarea + "Validate & Import" button. Validate against a Zod schema mirroring the notebook's `TAXONOMY` dict shape, so users who already have a taxonomy authored for *any* domain (the water-debris one from the original notebook, or something unrelated like defect categories or wildlife species) can paste it directly. On validation error, show inline field-level errors, not a raw stack trace.

### 6.4 Scene metadata builder (same pattern, separate from class taxonomy)
A parallel, simpler builder for the `scene_metadata_fields` table (§5): "Add Field" → key, label, type (`select`/`text`/`number`/`slider`/`textarea`), and options if applicable. This is what replaces the old tool's hardcoded lighting/water-body/turbidity widgets — those become just one project's *chosen* fields, authored the same way any other project would author "aisle number" or "scan modality." Editing this schema creates a new `scene_metadata_field_sets` version, same versioning rationale as §6.1.

### 6.3 Publishing a new version
"Save Taxonomy" button: if this is the project's first taxonomy, create `taxonomy_versions` v1. If editing an existing one, prompt: *"This creates version N. Existing annotations keep their original taxonomy version and won't change."* Then insert the new version + classes, set `is_active = true`, and flip the previous version's `is_active` to `false` (only the active version is offered for new annotations; old ones remain readable/exportable).

---

## 7. Annotation Canvas (porting the existing JS)

- Port `MODULE D` (canvas HTML/JS) into a React component (`<AnnotationCanvas />`). The drawing logic (mouse events, box rendering, class-color pills, progress bar) is largely DOM/canvas API code and transfers with light adaptation — swap direct `document.getElementById` calls for `useRef`, and swap the `ipywidgets` Python↔JS bridge for React props/callbacks.
- Keyboard shortcuts: keep the same scheme — number keys `1-9,0` map to the first 10 classes in the active taxonomy version's `sort_order`, `o` for a custom/other class, `Shift+drag` auto-tags with last-used class, `Enter` = Save & Next, `U` = Undo. Bind via a `useEffect` with `keydown` listener, guarded so it's ignored while a text input (Notes field) has focus — same guard the notebook already has.
- Image resize: replicate `ImageLoader` logic client-side (canvas `drawImage` with computed `ratio = min(maxDim/ow, 1.0)`), but read `maxDim`/quality from the project's `preprocessing` JSONB column instead of hardcoding 1000/92 (see §11).

### 7.1 Undo/Redo (full history, not just "undo last")
Implement as a reducer with three stacks: `past: Action[]`, `present: AnnotationState`, `future: Action[]`.
- Every mutation (`ADD_INSTANCE`, `REMOVE_INSTANCE`, `EDIT_INSTANCE`, `EDIT_META`) dispatches through the reducer, which pushes the *inverse* of the action onto `past` and clears `future`.
- `Ctrl+Z` pops from `past`, applies the inverse, pushes the forward action onto `future`. `Ctrl+Shift+Z` (or `Y`) replays from `future`.
- Persist each action to `annotation_history` (fire-and-forget, non-blocking) so the history survives a page reload and doubles as an audit log for QA review.
- A lightweight library like `zundo` (Zustand middleware) or `use-undo` can save you from hand-rolling this if you're using Zustand for canvas state; otherwise a plain `useReducer` with the stacks above is ~80 lines and dependency-free.

---

## 8. Review / QA Mode

- Roles come from `project_members.role`. `reviewer` and `owner` roles see an additional "Review Queue" view: all `annotations` where `status = 'pending'`, grouped by annotator.
- Reviewer can open any annotated image read-only-by-default, with an "Edit" toggle to make corrections (which go through the same undo/redo reducer, logged to `annotation_history` with `created_by = reviewer_id` so you can distinguish annotator vs. reviewer edits).
- Actions: **Approve** (`status = 'approved'`, `reviewed_by = auth.uid()`), **Flag** (`status = 'flagged'`, requires `review_notes`), or **Edit & Approve**.
- Dashboard (see §9) breaks down counts by status so a project owner can see review backlog.

---

## 9. Progress Dashboard

- A `/projects/[id]/dashboard` page, server-rendered (Next.js Server Component) for fast initial load, using Postgres aggregate queries (or a Postgres view for reuse):

```sql
create view project_stats as
select
  p.id as project_id,
  count(i.id) as total_images,
  count(i.id) filter (where i.status = 'done') as done_images,
  count(a.id) filter (where a.status = 'approved') as approved,
  count(a.id) filter (where a.status = 'flagged') as flagged,
  count(a.id) filter (where a.status = 'pending') as pending_review
from projects p
left join images i on i.project_id = p.id
left join annotations a on a.image_id = i.id
group by p.id;
```
- Class distribution chart: aggregate `jsonb_array_elements(grounded_instances) ->> 'object_name'` counts per project, exposed via a Postgres RPC function (`get_class_distribution(project_id)`), rendered with Recharts (bar or pie).
- Replaces the notebook's plain `print(f"📊 Total: ...")` statements with live, queryable, chartable numbers.

---

## 10. Export Presets

A `/api/export/[projectId]` Vercel API route supporting a `?format=` query param, split to stay within Hobby's Active CPU budget (§4.4): the route does only the JSON transform (cheap, fast) and returns the array of per-image objects; the browser does the zipping with JSZip client-side. This keeps compression — the slow, CPU-heavy part, especially for a large project — off Vercel entirely rather than running it inside a serverless function.

- **`fcot` (default)** — reproduces the original per-image JSON shape (`image_id`, `image_resolution`, `coord_format`, `scene_context`, `grounded_instances`, `total_objects`, `derived_diagnostics`), one object per image; the API route returns the array as-is (no transform needed), client zips into one file per image for download. Field names inside `scene_context` and `derived_diagnostics` are whatever the project defined — nothing hardcoded.
- **`coco`** — transform to COCO detection format: build a single `images[]` array (id, file_name, width, height), a `categories[]` array from the active taxonomy's classes, and `annotations[]` with COCO bbox format `[x, y, width, height]` in absolute pixels — you'll need to convert from the stored normalized `[ymin, xmin, ymax, xmax]` (0–1000) using each image's stored width/height:
  ```
  x = xmin/1000 * width
  y = ymin/1000 * height
  w = (xmax - xmin)/1000 * width
  h = (ymax - ymin)/1000 * height
  ```
- **`yolo`** — one `.txt` per image, each line `class_index x_center y_center width height` (all normalized 0–1, YOLO convention), plus a `classes.txt` / `data.yaml` mapping index→class_key. Same coordinate conversion, then to YOLO's center-based format.
- All three share one conversion utility (`lib/bboxConvert.ts`) so the coordinate math lives in exactly one place.

---

## 11. Configurable Image Preprocessing

- `projects.preprocessing` JSONB (`{max_dim, jpeg_quality}`) editable in a project settings panel.
- Applied client-side in `<AnnotationCanvas />` when loading each image: fetch original bytes from Drive, load into an offscreen `<canvas>`, compute `ratio = min(max_dim / originalWidth, 1.0)`, redraw at scaled size, export via `canvas.toBlob(..., 'image/jpeg', jpeg_quality/100)` before display — replacing the notebook's hardcoded PIL resize/quality with user-configurable values, same math otherwise.

---

## 12. Autosave Drafts

- On every canvas mutation, debounce (e.g. 800ms–1.5s via `lodash.debounce` or a custom hook) a write to `drafts` (upsert on `(image_id, user_id)`), storing the full in-progress `grounded_instances` + `scene_context` state — this is *not* the committed `annotations` row, so a half-finished image doesn't pollute the dashboard's "done" counts. **Write drafts via the Supabase client directly from the browser, not through a Vercel API route** — drafts don't need the server-side FCOT validation from §5.1 (they're allowed to be incomplete mid-edit), and routing frequent debounced writes through a serverless function needlessly spends Hobby's 1M/month invocation budget (§4.4) on traffic that a direct client write handles for free.
- On canvas mount, check for an existing draft for `(image_id, user_id)`; if present and newer than the committed annotation (if any), prompt *"Restore unsaved draft from [time]?"* with Restore/Discard.
- Also mirror the same debounced state to `localStorage` immediately (synchronous, no network wait) as a belt-and-suspenders fallback if the network write hasn't landed yet when the tab closes — read from localStorage first on mount, then reconcile against the DB draft (take whichever has the later timestamp).
- On explicit "Save & Next," delete the draft row (or leave it — cheap to leave and just overwrite next time) and write the real `annotations` row.

---

## 13. UI Design System

**Theme**: developer/terminal-coded aesthetic — monospace or monospace-adjacent headings (e.g. `JetBrains Mono` or `IBM Plex Mono` for labels/badges, a clean sans like `Inter` for body text so it's not fatiguing to read), syntax-highlight-inspired accent palette (cyan/teal accents, similar to the notebook's existing `--accent:#00e5ff` — worth carrying forward since it already reads as "technical tool").

**Dark/light toggle**:
- Use `next-themes`: wrap the app in `<ThemeProvider attribute="class">`, define both palettes as CSS variables in `globals.css` under `:root` (light) and `.dark` (dark) selectors, toggle via a button that calls `setTheme(theme === 'dark' ? 'light' : 'dark')`.
- Persist choice in localStorage automatically (built into `next-themes`); respect `prefers-color-scheme` as the default before first manual toggle.
- Example variable pattern (extending the notebook's existing palette):
  ```css
  :root {
    --bg: #f5f6fa; --surface: #ffffff; --text: #1a1d27; --muted: #5b6178;
    --accent: #0097a7; --warn: #d81b60;
  }
  .dark {
    --bg: #0b0d12; --surface: rgba(26,29,39,0.75); --text: #e8eaf6; --muted: #9aa3c4;
    --accent: #00e5ff; --warn: #ff4081;
  }
  ```
- All components reference `var(--bg)` etc. via Tailwind's `theme()` extension (map Tailwind color tokens to these CSS vars) rather than hardcoding `dark:` variants everywhere — keeps one source of truth and matches the notebook's existing CSS-variable-driven canvas styling almost directly.

---

## 14. Repository Structure (proposed)

```
/app
  /(auth)/login/page.tsx
  /projects/page.tsx                    -- project list
  /projects/[id]/page.tsx               -- annotate view (canvas)
  /projects/[id]/dashboard/page.tsx     -- progress + charts
  /projects/[id]/review/page.tsx        -- QA queue
  /projects/[id]/taxonomy/page.tsx      -- taxonomy builder
  /projects/[id]/scene-fields/page.tsx  -- scene metadata field builder
  /projects/[id]/settings/page.tsx      -- Drive folder, preprocessing config
  /api/export/[projectId]/route.ts      -- COCO/YOLO/FCOT export
  /api/drive/refresh/route.ts           -- refresh Drive access token
  /api/drive/list/route.ts              -- list images in a Drive folder
/components
  AnnotationCanvas.tsx
  TaxonomyForm.tsx
  TaxonomyJsonImport.tsx
  ClassPicker.tsx
  ProgressBar.tsx
  ThemeToggle.tsx
  ReviewPanel.tsx
  DashboardCharts.tsx
/lib
  supabase/client.ts
  supabase/server.ts
  drive.ts               -- Drive API wrapper (list, fetch bytes)
  bboxConvert.ts          -- shared coord math (normalized <-> pixel <-> YOLO)
  undoRedoReducer.ts
  zodSchemas.ts           -- taxonomy + annotation validation
/supabase
  migrations/*.sql        -- schema from §5
```

---

## 15. Suggested Build Order (milestones)

1. **Scaffold**: Next.js + Tailwind + Supabase project + auth (Google login) working end-to-end with an empty dashboard.
2. **Drive read path**: connect Drive scopes, list a folder's images, render one image on canvas (no annotation yet).
3. **Taxonomy builder + scene metadata builder**: form + JSON import, versioning for both. Seed one *example* project with the water-debris taxonomy from the original notebook purely as a test fixture — it should be indistinguishable in the schema from any other project's taxonomy, proving the tool has no domain assumptions baked in.
4. **Core annotation loop**: draw bbox → class picker (keyboard shortcuts) → save to `annotations` → reload persists correctly. This is the critical path — get parity with the notebook before adding anything else.
5. **Undo/redo** on top of the working loop.
6. **Autosave drafts.**
7. **Dashboard + review/QA mode.**
8. **Export presets (FCOT/COCO/YOLO).**
9. **Theming pass** (dark/light, visual polish) — do this last so it doesn't slow down functional milestones.

---

## 16. Open Decisions for the Building AI/Developer

- Whether `project_members` (multi-user) is needed for v1 or if single-owner-per-project is fine initially — needed only if Review/QA is used by a second real person, otherwise the owner can self-review.
- Google Drive API free-tier quota (1,000,000,000 quota units/day, ~"generous" per-user, but check current limits via Drive API docs before assuming — Anthropic's knowledge here may be stale).

---

## 17. Notes for the Building Agent (Google Antigravity)

This plan, plus the original `human_annotation_final_fix4.ipynb`, is being handed to Google Antigravity to build. A few things specific to that tool:

- **Use Plan mode, not Fast mode, for the initial scaffold and for each milestone in §15.** Antigravity should produce its own step-by-step plan artifact before writing files — review that plan against this document before letting it proceed, rather than letting it start coding directly off this spec.
- **Dev mode: use "Agent-assisted," not "Agent-driven/Autopilot," at least through the auth, RLS, and Drive OAuth milestones.** This project touches multi-tenant security (RLS policies) and OAuth token handling — both are the kind of thing that should get a human check-in before being marked done, not run unattended.
- **Persist key constraints in a `CONTEXT.md` / `.antigravity/` config**, not just this document, so they survive across sessions: images stay in Google Drive (never migrate to Supabase Storage), taxonomy and scene-metadata edits must version rather than mutate in place, and the FCOT block must be embedded in full on every saved instance (not just a class reference).
- **RLS policies are a known agent failure point** — explicitly ask it to state and verify the access policy for each table (owner-only vs. `project_members` role-based) against §5/§8 before moving to the next milestone, rather than assuming RLS was generated correctly.
- **Google OAuth/Drive scope setup (§4.1) is fiddly and easy to half-configure.** Test the actual Drive read flow yourself early — don't trust a "done" status on this step without verifying it end-to-end.
- **Taxonomy/scene-metadata versioning (§5, §6, §6.4) is the part most likely to get simplified incorrectly** if skimmed — ask the agent to restate the versioning invariant (old annotations keep the taxonomy/field-set version active when they were saved) back to you before it implements those tables.
- Antigravity can drive a real browser to self-verify UI — useful for confirming the dark/light toggle and canvas rendering, but make sure it's actually exercising the full draw → save → reload annotation loop (§15 milestone 4), not just checking that pages load.
- If it stalls on the more architecture-heavy pieces (undo/redo reducer in §7.1, the versioning logic in §5/§6), it supports switching the underlying model (e.g. to Claude Sonnet) per-task — worth doing for those specific milestones if the default model struggles.
