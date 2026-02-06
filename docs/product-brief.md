# Link & Sync — Background Brief

## One‑sentence summary
Link & Sync helps UW students automatically sync class schedules with friends and discover others who are free at the same time, so meetups are effortless without constant back‑and‑forth.

## The problem
At the start of every quarter, students trade schedules manually and then quickly lose track. Commuters in particular end up stuck on campus between classes without an easy way to see who’s also free. Students who want to meet new people also lack a simple, privacy‑respecting way to find peers with overlapping free time.

## The solution
Link & Sync pulls a student’s class schedule (via Canvas ICS) and turns it into a clean visual schedule plus “who’s free now.” It makes friend schedule overlap obvious and enables spontaneous, safe meetups based on shared availability.

## Core user flow (MVP)
1) Sign up with UW email
2) Import schedule (Canvas ICS)
3) Add friends by username or QR
4) View overlap schedule (friends + you)
5) See who’s free now (discoverable toggle)
6) Manage privacy and profile details

## MVP screens
- Onboarding: required profile info + optional hobbies/IG + schedule import
- Sync: visual weekly overlap for you + selected friends
- Link: discoverable list of nearby‑time free students
- Profile: about you, schedule views, friends list, privacy controls

## Key privacy principles
- Discoverability is **off by default**.
- Users can hide their schedule from specific friends.
- No location is shown; only availability windows.
- Sensitive fields stay in Supabase (no secrets in Git).

## Important technical choices (Phase 2)
- Schedule import via Canvas **ICS link** (fastest, no scraping).
- Supabase for auth + database + storage.
- RLS policies + RPCs to limit what’s visible to others.

## What success looks like
- A UW student can open the app and instantly see overlap with friends.
- The “who’s free now” page feels safe, clear, and opt‑in.
- Onboarding is fast (minutes) and does not overwhelm.

## Near‑term roadmap
- Improve class filtering from Canvas events
- Add stronger friend search + QR add
- Expand overlap visualization and “free now” filters
- Optional Canvas OAuth (later)

## Project status
Phase 1: UI/UX prototype is complete.
Phase 2: Real data integration in progress (auth, profiles, friends, schedules).

---
If you’re another agent or partner, use this brief to align on purpose, UX goals, and privacy constraints.
