# 🌐 Universal Squad Contributions, Private Workouts & Departed Member Controls

## 🎯 Objectives & Summary
The user requested three core data processing and permission changes:
1. **Universal Squad Contributions ("Everything should be everywhere")**:
   All workouts done by a user automatically contribute to all groups/squads they belong to and any squads they ever join in the future.
2. **Private Workout Option**:
   Workouts can optionally be marked as private (`is_private: true`). Private workouts stay exclusively in the user's personal solo room and do not contribute to group goals, leaderboards, or squad feeds.
3. **Departed Member Contribution Choice for Owners**:
   When a member leaves a group (either voluntarily or via owner removal), the squad owner has the choice whether to keep their past workout contributions in the squad or purge them (with automatic rollback of goal metrics).

---

## 🏗️ Architecture Design

```
[ Workout Logged / Imported / Stepper / Batch ]
               │
               ▼
       Is Workout Private?
       ├── YES: Stored ONLY in `solo-<user_token>` with `is_private = 1`
       │        (Never forwarded, never synced to squads)
       │
       └── NO:  Stored in `solo-<user_token>` as root activity (`is_private = 0`)
                AND immediately forwarded/created in ALL squads user currently belongs to
                (Linked via `parent_activity_id = root.id`)

[ User Joins or Visits a Squad / Group ]
               │
               ▼
[ Sync Engine: `sync_user_activities_to_room` ]
  - Finds all non-private root workouts of the user not yet in this squad
  - Replicates child activities to this squad with `parent_activity_id = root.id`
  - Auto-routes to matching active goals and increments progress
  - Evaluates goal completions and updates squad leaderboard

[ Member Departs or is Removed from Squad ]
  - Case 1: Owner removes member -> Owner chooses: Keep or Purge contributions
  - Case 2: Member voluntarily leaves -> Controlled by squad policy `keep_departed_contributions`
  - Case 3: Owner reviews Departed Contributors at any time -> One-click Purge action
```

---

## 📦 Detailed Implementation Phases

### Phase 1: Database Schema & Migration (`src/db.rs`, `src/models.rs`, `src/store/`)
1. **Schema Enhancements**:
   - `activities`: Add `is_private INTEGER NOT NULL DEFAULT 0` and index `idx_activities_private`.
   - `rooms`: Add `keep_departed_contributions INTEGER NOT NULL DEFAULT 1`.
2. **Model Definitions**:
   - Update `Room` to include `keep_departed_contributions: bool`.
   - Update `Activity` to include `is_private: bool`.
   - Update `LogActivityRequest` and `UpdateActivityRequest` to include `is_private: Option<bool>`.
   - Add `RemoveMemberRequest { keep_contributions: Option<bool> }`.
   - Add `UpdateRoomSettingsRequest { keep_departed_contributions: Option<bool> }`.
   - Add `DepartedContributor` model and include in `RoomDataResponse`.
3. **Store Traits & Mappers**:
   - Update `map_room` and `map_activity`.
   - Add store methods for `sync_user_activities_to_room`, `purge_member_contributions`, `get_departed_contributors`, `update_room_settings`.

### Phase 2: Backend Logic & Universal Sync (`src/db.rs`, `src/routes.rs`)
1. **Activity Creation & Forwarding**:
   - If `is_private == true`: Save only in user's solo room.
   - If `is_private == false`: Save root in user's solo room, and replicate child activities with `parent_activity_id` to all squads the user belongs to.
2. **On-Join Historical Sync**:
   - In `ensure_room_member` and room creation: call `sync_user_activities_to_room`.
   - All past non-private workouts of the user immediately populate the squad, advance active goals, and reflect on the leaderboard.
3. **Activity Updates & Toggles**:
   - Toggling an activity from public to private purges child copies from squads and rolls back squad goals.
   - Toggling from private to public replicates child copies to all squads the user is in.
4. **Member Removal & Departure**:
   - Owner removal with choice (`keep_contributions = false` purges squad activities and rolls back goals; `true` preserves them).
   - Voluntary leave respects room `keep_departed_contributions`.
   - Explicit owner purge endpoint `POST /room/:slug/members/:target_token/purge-contributions`.
   - Squad settings update endpoint `POST /room/:slug/settings`.

### Phase 3: Frontend UI / UX ("Zero Fluff, High Tactile Polish")
1. **Privacy Toggles**:
   - Checkbox / toggle "Private workout" in Stepper, Fast Add, Batch/Import, and Edit Activity modals.
   - "🔒 Private" badge in activity feed for solo private workouts.
2. **Squad Settings (Owner Controls)**:
   - Setting toggle: "Keep contributions when members leave".
   - Departed Contributors list with one-click "Purge Workouts" button.
   - Confirmation modal when removing an active member with Keep / Purge options.

### Phase 4: Verification & Autonomous Delivery
1. Run Rust test suite & integration tests.
2. Verify formatting (`cargo fmt`) and clippy (`cargo clippy`).
3. Commit and push directly to `main` for automated CI/CD.
