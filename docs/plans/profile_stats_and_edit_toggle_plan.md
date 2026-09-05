# 👤 Architecture & Execution Plan: Profile Stats & Toggleable Edit Mode

## 🎯 Motivation & Objectives
The user requested:
> "the edit profile stuff should only show when edit profile is clicked. we should put a little more personal stats, or recent developments in this panel"

Following the **Tardigrade Tough Directives** (`tardigrade-tough-directives/SKILL.md`):
1. **Zero Fluff & Minimalism ("If Intuitive, Do Not Explain")**:
   - Do not display dense explanatory subtext or walls of editing inputs on default view.
   - Clean, compact visual hierarchy.
2. **Compact & Mobile-First (390x844 Viewport)**:
   - High data density without visual clutter or vertical page runaway.
   - Distinct View vs. Edit states within `#hubPaneProfile`.
3. **Rich Personal Telemetry**:
   - **Personal Stats Grid**: Cumulative sets logged, total tonnage hoisted, distance & elevation conquered, personal feats/PRs count, MVP status.
   - **Personal Records**: Compact pill badges for best lifts, longest distance, and highest elevation.
   - **Recent Developments**: A chronological feed of the user's recent workouts and accomplishments with relative timestamps (`formatTimeAgo`).
4. **Intuitive Profile Editing**:
   - Clicking `[ ✏️ Edit Profile ]` reveals the nickname input, avatar emoji/initials switcher, color picker swatches, and `[ Cancel ]` / `[ Save ]` actions.
   - Saving or canceling seamlessly returns to the clean telemetry view.

---

## 🏗️ Architecture Design

```
[ Settings Modal: Profile Tab (#hubPaneProfile) ]
   │
   ├── #profileViewContainer (Default: Visible)
   │     ├── Header: Avatar Chip + Nickname + Streak/State + [ ✏️ Edit Profile ]
   │     ├── Personal Stats Grid (2x2 / 4-card metric display)
   │     │     ├── 🏋️ Total Volume (lbs)
   │     │     ├── 🔢 Total Sets
   │     │     ├── ⛰️ Distance / Elevation
   │     │     └── 🏆 Feats & PRs
   │     ├── 👑 Personal Records (PR pills)
   │     ├── ⚡ Recent Developments (User's last 3-5 personal activities + relative time)
   │     └── App Preferences (Dark/Light theme toggle + PWA install)
   │
   └── #profileEditContainer (Default: Hidden / Revealed on "Edit Profile" click)
         ├── Header: Live Avatar Chip + Nickname preview
         ├── Nickname Input (#nickInput)
         ├── Avatar Selection (Emoji Grid + Initials Toggle)
         ├── Color Palette Swatches (#colorPickerRow)
         └── Actions: [ Cancel ] (revert) and [ Save Profile ] (persist & toast)
```

---

## 📦 Implementation Phases

### Phase 1: Plan Documentation & Architecture (Current)
- [x] Create and commit `docs/plans/profile_stats_and_edit_toggle_plan.md`.

### Phase 2: HTML Markup Restructuring (`static/index.html`)
- [x] In `#hubPaneProfile`, partition into:
  - `#profileViewMode` (active/visible by default)
  - `#profileEditMode` (hidden by default)
- [x] Add `#startEditProfileBtn` to header.
- [x] Add `#profileStatsGrid` with metric tiles.
- [x] Add `#profileRecentCard` and `#profileRecentList`.
- [x] Move nickname input, emoji grid, initials toggle, color swatch picker, and save button into `#profileEditMode`.
- [x] Add `#cancelProfileEditBtn` inside `#profileEditMode`.

### Phase 3: CSS Styling (`static/css/modals.css`)
- [x] Style `.profile-stats-grid` and `.profile-stat-box` for crisp retro-gaming aesthetics.
- [x] Style `.profile-recent-list` and `.profile-recent-item`.
- [x] Ensure seamless dark/light theme variables and 390x844 mobile viewport scaling.

### Phase 4: Frontend Logic (`static/js/modals.js`)
- [x] Import `formatTimeAgo` from `./activity-feed.js`.
- [x] Implement `showProfileEdit()` and `cancelProfileEdit()`.
- [x] Implement `renderProfileTelemetry()`:
  - Aggregate user stats from `state.currentRoomData.leaderboard` (matching `user_token`).
  - Render personal records pills from `state.currentRoomData.personal_records`.
  - Filter and render the user's latest activities from `state.currentRoomData.recent_activities`.
- [x] Update `openHub()` and `selectHubTab()` to refresh telemetry and default to `#profileViewMode`.
- [x] Wire up `[ ✏️ Edit ]` to open edit mode, `[ Cancel ]` to revert, and `[ Save ]` to save, update state, and return to view mode.

### Phase 5: Verification & Testing
- [x] Check formatting: `cargo fmt --all -- --check`.
- [x] Check clippy: `cargo clippy --all-targets -- -D warnings`.
- [x] Run backend tests: `cargo test --all-targets` (28/28 tests passing).
- [x] Run affected test runner: `npm run test:affected`.

### Phase 6: Autonomous Deployment
- [ ] Commit with clean git message.
- [ ] Push to `origin/main`.
- [ ] Deploy to Fly.io (`fly deploy`) and verify HTTP 200 OK.
- [ ] Mark plan complete.
