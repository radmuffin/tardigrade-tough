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
- [ ] **Backend Architecture**:
  - Add query helper in `src/db.rs` to detect if a logged activity is a Personal Record (PR) for that user on that specific `exercise_name` (e.g. highest `weight_per_rep`, longest `distance_val`, or greatest `elevation_val`).
  - Return `is_pr: bool` in `Activity` response model.
  - Expose user PR summary endpoint `GET /api/user/prs` or include in room user profile.
- [ ] **Frontend & UI**:
  - Render a crisp, minimal badge: `<span class="pr-badge">👑 PR</span>` on matching items in `static/js/activity-feed.js`.
  - When a PR is logged, trigger celebratory golden sparkle particles on `PixelDiorama`.
  - In Profile Modal, show personal best records cleanly without bloat.
- [ ] **Tests**:
  - Integration tests verifying PR detection for weights, distance, and elevation.

### Phase 2: Streak & Consistency Tracker (Tardigrade Hydration)
- [ ] **Backend Architecture**:
  - Calculate active day streaks for a user: consecutive active calendar days (UTC).
  - Add `streak_days: i32` and `tardigrade_state: String` ("hydrated" vs "cryptobiosis") to `UserProfile`.
- [ ] **Frontend & UI**:
  - Sleek, compact streak chip in the header and profile: e.g. `🔥 3d` or `💧 Active`.
  - Status display in Profile Modal: "Hydrated" (streak active) vs "Cryptobiosis" (dormant/resting).
- [ ] **Tests**:
  - Integration tests verifying multi-day streak calculation and rest-day behavior.

### Phase 3: Offline Queue Sync Indicator
- [ ] **Frontend & UI**:
  - In `static/offline-sync.js` and `static/js/pwa.js`, emit queue size change callbacks.
  - Add a discreet header pill `#offlineSyncBadge`:
    - Hidden when queue is empty and network is online.
    - Displays `⚡ {count} queued` when offline or pending.
    - Flashes brief green `✔ Synced` on completion, then fades away.
  - Matches exact height and typography of `.squad-pill` and `.theme-toggle`.
- [ ] **Tests**:
  - Unit tests in frontend and Playwright verification.

### Phase 4: Custom Room Quests with Pixel Diorama Palettes
- [ ] **Backend Architecture**:
  - Enhance `POST /api/goals` to allow room creators/members to define custom room quests with:
    - `title`, `category`, `target_value`, `unit`, `theme_key`, `description`.
  - Support theme keys: `pando`, `everest`, `caribou`, `whale`, `volcano` (Magma Crimson), `canopy` (Emerald Rainforest).
- [ ] **Frontend Canvas & Themes**:
  - Add `renderVolcano` and `renderCanopy` palettes to `static/canvas-art.js`.
  - Provide a compact "+ New Quest" action in the quests showcase.
  - Compact modal: Title, Category, Target, Unit, Palette preview.
- [ ] **Tests**:
  - Integration tests verifying custom quest creation, goal progression, and auto-routing.

---

## 📈 Execution Log
- **2026-09-05**: Directive skill `.agents/skills/tardigrade-tough-directives/SKILL.md` written. Initial plan checked in.
