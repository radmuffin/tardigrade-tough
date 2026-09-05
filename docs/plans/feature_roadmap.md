# 🗺️ Tardigrade Tough Feature Roadmap & Execution Plan

This document outlines the design, architecture, and step-by-step execution plan for the four prioritized enhancements:
1. **Personal Record (PR) & Milestone Badges**
2. **Streak & Consistency Tracker (Tardigrade Hydration / Cryptobiosis)**
3. **Offline Queue Sync Indicator**
4. **Custom Room Quests with Pixel Diorama Palettes**

---

## 🎯 Directives & Constraints Checklist
- **UI Minimalism**: Zero unnecessary words, zero explanatory subtext ("If intuitive, do not explain").
- **Stylistic Cohesion**: Dual theme (Dark & Light) CSS variable support, mobile-first (390x844), retro pixel aesthetic.
- **Zero Tech Debt**: Parameterized SQLite queries, atomic transactions, multi-tenant isolation, clean model helper methods, zero memory leaks.
- **Zero-Build ES6+**: No bundlers or npm runtime dependencies in `static/`.
- **Test Integrity**: Full coverage with `npm run test:affected` and `cargo test --all-targets`.

---

## 📦 Phase Breakdown & Status

### Phase 1: Personal Record (PR) & Milestone Badges
- [x] **Backend Architecture**:
  - Add query helper in `src/db.rs` to detect if a logged activity is a Personal Record (PR) for that user on that specific `exercise_name` (highest `weight_per_rep`, longest `distance_val`, or greatest `elevation_val`).
  - Return `is_pr: bool` in `Activity` response model.
  - Expose user PR summary endpoint `GET /api/user/prs` and include in `RoomDataResponse`.
- [x] **Frontend & UI**:
  - Render a crisp, minimal badge: `<span class="pr-badge">👑 PR</span>` on matching items in `static/js/activity-feed.js`.
  - When a PR is logged, trigger celebratory golden sparkle particles on `PixelDiorama`.
  - In Profile Modal, show personal best records cleanly without bloat.
- [x] **Tests**:
  - Integration tests verifying PR detection for weights, distance, and elevation (`test_personal_record_detection_and_query`).

### Phase 2: Streak & Consistency Tracker (Tardigrade Hydration)
- [x] **Backend Architecture**:
  - Calculate active day streaks for a user: consecutive active calendar days (UTC).
  - Add `streak_days: i32` and `tardigrade_state: String` ("hydrated" vs "cryptobiosis") to `UserProfile`.
- [x] **Frontend & UI**:
  - Sleek, compact streak chip in the header (`#streakBadge`) and profile: e.g. `🔥 3d` or `💤 0d`.
  - Status display in Profile Modal: "Hydrated" (streak active) vs "Cryptobiosis" (dormant/resting).
- [x] **Tests**:
  - Integration tests verifying multi-day streak calculation and rest-day behavior (`test_user_streak_and_tardigrade_state`).

### Phase 3: Offline Queue Sync Indicator
- [x] **Frontend & UI**:
  - In `static/offline-sync.js` and `static/js/pwa.js`, emit queue size change callbacks.
  - Add a discreet header pill `#offlineSyncBadge`:
    - Hidden when queue is empty and network is online.
    - Displays `⚡ {count} queued` when offline or pending.
    - Flashes brief green `✔ Synced` on completion, then fades away.
  - Matches exact height and typography of `.squad-pill` and `.theme-toggle`.
- [x] **Tests**:
  - Verified PWA offline cache lifecycle and sync status callbacks.

### Phase 4: Custom Room Quests with Pixel Diorama Palettes
- [x] **Backend Architecture**:
  - Enhance `POST /api/goals` to allow room creators/members to define custom room quests with:
    - `title`, `category`, `target_value`, `unit`, `theme_key`, `description`.
  - Support theme keys: `pando`, `everest`, `caribou`, `whale`, `volcano` (Magma Crimson), `canopy` (Emerald Rainforest).
- [x] **Frontend Canvas & Themes**:
  - Add `renderVolcano` and `renderCanopy` palettes to `static/canvas-art.js`.
  - Provide a compact "+ New Quest" action in the quests showcase.
  - Compact modal: Title, Category, Target, Unit, Palette preview.
- [x] **Tests**:
  - Integration tests verifying custom quest creation, goal progression, and auto-routing (`test_create_custom_quest_with_theme_palette`).

---

## 📈 Execution Log
- **2026-09-05**: Directive skill `.agents/skills/tardigrade-tough-directives/SKILL.md` written and checked in.
- **2026-09-05**: Initial plan documentation checked in.
- **2026-09-05**: Backend PR detection engine and streak/tardigrade state tracking implemented in `src/models.rs`, `src/db.rs`, `src/routes.rs`.
- **2026-09-05**: Pixel art diorama palettes implemented for Volcano (Magma Crimson) and Canopy (Emerald Rainforest) in `static/canvas-art.js`.
- **2026-09-05**: Frontend UI components created: `#streakBadge` header chip, `#offlineSyncBadge` queue status chip, PR badges in activity feed, personal bests pill cards in profile modal, and `#createQuestModal` with palette picker.
- **2026-09-05**: All 25 backend integration tests passing cleanly. Code formatted and Clippy warnings zero.
