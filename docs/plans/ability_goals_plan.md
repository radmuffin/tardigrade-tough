# ⚡ Architecture & Execution Plan: One-Off Ability Goals & Checkoff System

## 🎯 Motivation & Objectives
Athletes and gym squads train not only for cumulative tonnage, mileage, and elevation, but also for discrete physical abilities and milestone feats (e.g., **Backflip**, **Muscle Up**, **Handstand**, **Pistol Squat**, **L-Sit**). Unlike cumulative goals (e.g. 13.2M lbs or 3,000 miles), abilities are **one-off feats** that should be marked accomplished with a single, satisfying checkoff action.

This plan introduces:
1. **First-Class "Ability" Goal Category**: Goals with `category = 'ability'`, target 1.0 feat, and custom themes/icons (`⚡`, `🤸`, `🥋`).
2. **Dedicated Checkoff API (`POST /api/goals/:id/checkoff`)**:
   - Atomically records an `ability` activity.
   - Sets `current_value = 1.0` and marks `status = 'completed'`.
   - Detects first-time achievement as a Personal Record (`🔥 PR`).
   - Emits real-time WebSocket events (`activity_logged`, `goal_completed`) and triggers celebration particle bursts.
   - In solo mode, auto-forwards to user squads so the crew can celebrate the feat.
   - Transactional rollback: undoing or deleting the activity in the feed automatically reverts the goal to `'active'`.
3. **Streamlined UI / UX ("Zero Fluff, High Tactile Polish")**:
   - When an ability goal is active, the Stepper/Workout dock displays a dedicated **Ability Feat Checkoff Panel** with a prominent `[ ✓ Mark Accomplished ]` action and optional quick note.
   - "New Quest" (`#createQuestModal`) and "Propose Quest" (`#wishlistModal`) feature `⚡ Ability (One-off Feat)` with pre-configured target and unit.
   - Activity Feed shows `⚡ Feat` badge with PR highlights.
   - Hall of Trophies displays both conquered cumulative milestones (e.g. The Blue Whale) and accomplished ability feats in a trophy grid.

---

## 🏗️ Architecture Design

```
[ Frontend: Quests View ]
   ├── Goal Selector: [🌲 Pando] [🐐 Everest] [🦌 Caribou] [⚡ Muscle Up]
   └── Ability Check-off Dock: [ ✓ Mark Accomplished ]
              │
              ▼ POST /api/goals/:id/checkoff (or /api/activities)
[ Axum Route Handler: checkoff_goal_handler ]
              │
              ▼
[ GoalStore / ActivityStore Trait: checkoff_goal ]
              │
              ▼
[ SqliteStore Transaction ]
   ├── INSERT INTO activities (activity_type='ability', sets=1, reps=1, total_metric=1, is_pr=...)
   ├── UPDATE goals SET current_value=1.0, status='completed' WHERE id = ?
   ├── IF solo mode: Auto-forward to squad rooms
   └── Broadcast WebSocket ("activity_logged", "goal_completed")
              │
              ▼
[ Client Reactive UI ]
   ├── Diorama celebration burst
   ├── Feed update with "⚡ Feat" & "👑 PR"
   └── Conquered trophy card in Hall of Fame
```

---

## 📦 Implementation Phases

### Phase 1: Backend Domain Models & Store Traits (`src/models.rs`, `src/store/traits.rs`, `src/store/sqlite.rs`)
- [x] Add `CheckoffGoalRequest` model in `src/models.rs`.
- [x] Update `GoalStore` trait with `checkoff_goal(&self, user: &UserProfile, goal_id: i64, notes: Option<&str>) -> StoreResult<(Goal, Activity)>`.
- [x] Update `SqliteStore` to implement `checkoff_goal`.

### Phase 2: Database Logic & Auto-PR Detection (`src/db.rs`)
- [x] Implement `checkoff_goal` in `src/db.rs` with transactional boundary.
- [x] Update `log_single_activity` in `src/db.rs`:
  - Support `activity_type = 'ability'` with default `total_metric = 1.0`.
  - Add auto-PR detection for first-time ability achievement (`COUNT(*) == 0`).
  - Ensure deletion rollback (`delete_activity`) properly reverts ability goals to `'active'`.

### Phase 3: Route Handlers & WebSocket Broadcasting (`src/routes.rs`)
- [x] Add `POST /goals/:id/checkoff` route in `src/routes.rs`.
- [x] Ensure solo auto-forwarding propagates ability completions to user squads.
- [x] Broadcast `goal_completed` and `activity_logged` events on `state.hub`.

### Phase 4: Frontend UI & Tactile Checkoff Experience (`static/`)
- [x] `static/index.html`:
  - Add `#panelAbilityCheckoff` inside the logging card for ability quests with `[ ✓ Mark Accomplished ]` button and optional note input.
  - Add `⚡ Ability (One-off Feat)` option to `questCategorySelect` and `wishlistCategorySelect`.
  - Add dynamic conquered cards container in `#viewTrophy` so all conquered trophies and abilities appear.
- [x] `static/js/workouts.js` & `static/js/navigation.js`:
  - Detect `goal.category === 'ability'` in `renderGoalShowcase`.
  - Toggle `#panelAbilityCheckoff` when an ability goal is active.
  - Wire up checkoff button to call `POST /api/goals/:id/checkoff`, spawn celebration particles, and show toast.
  - Support `⚡` emoji in segmented buttons.
- [x] `static/js/modals.js`:
  - Auto-set target to 1 and unit to `feat` when `ability` category is selected in modals.
- [x] `static/js/activity-feed.js`:
  - Format `activity_type === 'ability'` as `⚡ Feat` with clean text.
- [x] `static/js/trophy.js`:
  - Render full list/grid of all conquered goals (milestones + abilities) in the Hall of Fame.

### Phase 5: Verification & Quality Assurance
- [x] Integration tests in `tests/integration_tests.rs`:
  - Test ability goal creation, checkoff endpoint, PR detection, and activity generation.
  - Test rollback / uncheck via activity deletion reverting status to active.
  - Test solo room auto-forwarding for ability checkoffs to squad rooms.
- [x] Format check: `cargo fmt --all -- --check`.
- [x] Clippy check: `cargo clippy --all-targets -- -D warnings`.
- [x] Full backend tests: `cargo test --all-targets` (all 28 tests pass).
- [x] Fast affected runner: `npm run test:affected`.
- [x] Autonomous commit and push to `origin/main`.
- [x] Deploy to Fly.io via `fly deploy` and test live health endpoint.

---

## 📈 Execution Log
- **2026-09-05**: Created and checked in plan doc `docs/plans/ability_goals_plan.md`.
- **2026-09-05**: Implemented `CheckoffGoalRequest` and `CheckoffGoalResponse` models, updated `GoalStore` and `SqliteStore` with `checkoff_goal`.
- **2026-09-05**: Added database logic for ability metric defaults, PR detection on first accomplishment, and `checkoff_goal` transaction in `src/db.rs`.
- **2026-09-05**: Added `/goals/:id/checkoff` route in `src/routes.rs` with squad auto-forwarding and WebSocket broadcasting.
- **2026-09-05**: Updated frontend UI: `#panelAbilityCheckoff`, dynamic tab switching, tactile `✓ Mark Accomplished` button, modal dropdowns, activity feed `⚡ Feat` formatting, and dynamic Hall of Trophies.
- **2026-09-05**: Added comprehensive backend integration tests covering creation, checkoff, PR detection, undo/rollback, and solo forwarding.
