# Implementation Plan: Invites, Profiles & Permissions

This document outlines the architectural changes required to support email-based invitations, unique user profiles, and strict export permissions.

## 1. Database Schema Additions

We will create a new migration file to safely add the required tables without disrupting existing data.

**Table: `profiles`**
- `id` (uuid, references `auth.users`, Primary Key)
- `username` (text, UNIQUE) - Allows us to catch "username taken" errors directly from Postgres.
- `created_at` (timestamptz)

**Table: `project_invites`**
- `id` (uuid, Primary Key)
- `project_id` (uuid, references `projects`)
- `invited_email` (text) - Storing email allows you to invite people *before* they have even created an account!
- `role` (text) - 'annotator' or 'reviewer'
- `invited_by` (uuid, references `auth.users`)
- `status` (text) - 'pending', 'accepted', or 'rejected'

---

## 2. The Invitation & Notification System

**Project Settings (Owner UI):**
- We will modify the new "Team & Access" panel. Instead of instantly adding users to `project_members`, the "Invite" button will now insert a `pending` row into the `project_invites` table.

**The Notification Bell (Global UI):**
- We will add a global navigation bar (or overlay) with a **Notification Bell** that appears across the app (especially on the `/projects` dashboard).
- The bell will poll a new API endpoint (`/api/me/invites`) which searches the `project_invites` table for the currently logged-in user's email.
- Clicking the bell opens a dropdown:
  - **Accept**: Hits an API that changes the invite status to `accepted` AND securely inserts the user into `project_members`, instantly making the project appear on their dashboard.
  - **Decline**: Marks the invite as `rejected`.

---

## 3. User Profiles & Activity Feed

**The `/profile` Page:**
- A brand new page dedicated to the user.
- **Username Setup:** An input field to claim their unique `@username`. If the database throws a unique constraint error, the UI will display "Sorry, that username is taken."
- **Activity Feed:** We will query the `annotation_history` audit table we built earlier, filtering by `created_by = [user.id]`.
  - The UI will parse the `action_type` (e.g., `initial_save`, `approve`, `flag`, `edit_instances`) and render a beautiful timeline of their recent work across all projects (e.g., *"Annotated IMG_123.jpg"* or *"Flagged IMG_456.jpg"*).

---

## 4. Strict Export Permissions

**Role Verification:**
- Currently, anyone in the project can load the Export page. We will modify `app/projects/[id]/export/page.tsx`.
- On page load, it will check the user's role in `project_members`.
- If `role !== 'owner'`, the page will immediately render an "Access Denied" state with a clear message: *"Only Project Owners are permitted to export and download datasets."*
- (Optional but recommended) We will also hide the "Go to Export Page" button entirely from the Dashboard if the user is an Annotator or Reviewer.
