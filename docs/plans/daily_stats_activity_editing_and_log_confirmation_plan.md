# Daily Stats, Activity Editing, and Clear Logging Confirmation Plan

## Overview
This feature addresses three key UX improvements requested by the user:
1. **Activity Editing**: Ability to edit recent logs (exercises, sets, reps, weight/distance/elevation, notes, PR/combined/private status) with full backend metric recalculation and room goal updates.
2. **Daily Stats ("How much you did in one day")**:
   - Compact "Today's Work" banner and recent sets card directly on the main Quests/Workout screen.
   - Daily grouped dividers in the Live Activity Feed with day-by-day tonnage and set totals.
   - "Today's Work" metric tile in the athlete profile modal.
3. **Clear Logging Confirmation**:
   - Immediate button feedback (checkmark flash, e.g. "✓ Logged +2,250 lbs!").
   - Haptic vibration feedback (`navigator.vibrate`) on supported devices.
   - Descriptive toast with exercise name and breakdown.
   - Visual insertion and highlight animation in the Recent Sets list right below the log button.

---

## Phase 1: Backend Data Model & Metrics Recalculation
- Update `UpdateActivityRequest` in `src/models.rs` to support `distance_val`, `elevation_val`, and `total_metric`.
- Update `update_activity` in `src/db/activities.rs`:
  - Read existing activity type and values.
  - Recompute `total_metric` properly for weight, distance, elevation, ability, or custom metrics.
  - Update activity row and child forwarded activities in squad rooms.
  - Trigger `recalculate_room_goals` so room goals, percentages, and trophies stay in sync.
- Add backend unit/integration tests in `src/db/tests.rs` and `tests/integration_tests.rs`.

---

## Phase 2: Recent Sets Card & Main Screen Quick Edit
- Add `#recentSetsCard` directly under the logging dock on the Quests view.
- Render the user's latest logged sets with:
  - Exercise, sets x reps @ weight / distance / elevation, time ago.
  - PR, Combined, and Private badges.
  - Quick Edit (`✎`) button opening `activityEditModal`.
  - Quick Delete (`✕`) button to undo with confirmation.
- Show running daily summary in header: `Today: 14,250 lbs · 18 sets`.

---

## Phase 3: Activity Edit Modal Support for All Metrics
- Update `static/js/modals/activity-edit.js` to accurately pre-fill and submit `distance_val`, `elevation_val`, `weight_per_rep`, and `total_metric`.
- Smooth state reloading upon save.

---

## Phase 4: Daily Totals Across the App
- In `static/js/activity-feed.js`:
  - Group activities by local day (`Today`, `Yesterday`, or formatted date).
  - Include subtotal summary headers for each day group (`Today — 14,250 lbs • 18 sets`).
  - Add `#activityDayBanner` at top of activity view showing today's work at a glance.
- In `static/js/modals/hub.js`:
  - Add Today's Work tile to the profile modal stats grid.

---

## Phase 5: Clear Logging Confirmation & Tactile Feedback
- In `static/js/workouts.js`:
  - Animate buttons on click to show success state (`✓ Logged +2,250 lbs!` / `✓ Set Recorded!`).
  - Add haptic pulse via `navigator.vibrate([40, 30, 40])`.
  - Enhance toast notification to include exercise details.
  - Flash new item in Recent Sets list with `.new-set-flash`.

---

## Phase 6: Verification & Testing
- Run `cargo test --all-targets`.
- Run `npm run test:affected`.
- Commit and push autonomously to `origin/main`.
