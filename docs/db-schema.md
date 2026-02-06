# Link & Sync � Database Schema (MVP)

This document explains the MVP database schema and how each table is used.

## profiles
Stores user profile + onboarding data.

Columns:
- id (uuid): matches auth user id.
- username (text, unique): primary friend lookup handle.
- full_name (text): display name.
- email (text, unique): UW email.
- campus (text): Seattle/Bothell/Tacoma.
- major (text): used for discovery + display.
- year (text): class standing.
- ig_handle (text, optional): Instagram handle.
- hobbies (text[], optional): discovery tags.
- avatar_url (text, optional): profile photo URL.
- discoverable (bool): whether user appears in Link view.
- verified_at (timestamptz): UW email verification timestamp.
- created_at (timestamptz): profile creation time.

## friendships
Tracks friend requests and accepted friendships.

Columns:
- id (uuid): row id.
- requester_id (uuid): sender.
- addressee_id (uuid): receiver.
- status (text): pending / accepted / blocked.
- created_at (timestamptz).

## classes
Raw class schedule blocks imported from iCal uploads.

Columns:
- id (uuid).
- user_id (uuid).
- title (text): class name.
- day (int): 0-6.
- start_time (time).
- end_time (time).
- term (text, optional).
- source (text): default 'ics'.
- created_at (timestamptz).

## free_blocks
Precomputed free-time blocks for fast "who is free now" queries.

Columns:
- id (uuid).
- user_id (uuid).
- day (int): 0-6.
- start_time (time).
- end_time (time).
- created_at (timestamptz).

## privacy_rules
Per-friend privacy settings.

Columns:
- id (uuid).
- user_id (uuid): owner of the schedule.
- friend_id (uuid): friend the rule applies to.
- hide_all (bool): hide entire schedule from this friend.
- hidden_block_ids (uuid[]): hide specific class blocks.
- created_at (timestamptz).

## schedule_imports
Tracks schedule import metadata and sync status.

Columns:
- id (uuid).
- user_id (uuid).
- ics_url (text, optional): legacy Canvas link.
- import_source (text): e.g. myuw_file.
- ics_file_name (text, optional).
- last_synced_at (timestamptz).

## Storage bucket
Bucket name: avatars
Purpose: store profile photos. URL is saved in profiles.avatar_url.


## Likely future updates
- Add notifications table (friend requests).
- Add blocking/reporting tables.
- Add schedule versioning or import hash to detect changes.

