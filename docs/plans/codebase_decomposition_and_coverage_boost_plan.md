# 🏗️ Codebase Decomposition & Test Coverage Expansion Plan

## 1. Objectives & Rationale
As Tardigrade Tough has grown with real-time squads, personal telemetry, universal workout replication, and offline sync, key components have become large monoliths:
- `src/db.rs`: ~2,040 lines
- `static/js/modals.js`: ~1,815 lines
- `src/routes.rs`: ~1,325 lines
- `static/canvas-art.js`: ~1,145 lines
- Test coverage currently concentrates on high-level integration tests (34 tests) and core E2E tests (14 tests). Several business-critical modules lack granular unit tests.

This plan details:
1. **Zero-Tech-Debt Decomposition**: Refactoring monoliths into single-responsibility modules while maintaining 100% backward-compatible APIs, zero node bundlers for client JS, and clean transactional boundaries.
2. **Comprehensive Test Coverage Boost**: Adding backend unit tests for domain business logic (metrics, streak, PRs, bounds) and expanding frontend E2E specs (universal squad sync, private workout isolation, departure purge flows, share modal UX).

---

## 2. Architecture & Decomposition Strategy

### Phase 1: Frontend Modals Decomposition (`static/js/modals/`)
Decompose the 1,815-line `static/js/modals.js` into focused ES6 modules:
- `static/js/modals/importer.js`: Google Sheet & batch importer logic, tab/comma parsing, tonnage calculation.
- `static/js/modals/activity-edit.js`: Edit activity values, retroactively toggling PRs and privacy status.
- `static/js/modals/custom-quest.js`: Custom benchmark quest proposal and creation with theme palette selection.
- `static/js/modals/wishlist.js`: Squad quest wishlist proposal, voting, and retrieval.
- `static/js/modals/share.js`: Dedicated app share modal with URL copy, native Web Share API, and QR rendering.
- `static/js/modals/about.js`: About & lore modal, water bear philosophy, creator contact cards.
- `static/js/modals/hub.js`: Settings & Squad Hub (Profile tab, avatar customization, squad roster, departure rules, departed contributors, squad invite link/QR).
- `static/js/modals.js`: Lean facade exporting `setupModals()`, coordinating lifecycle without breaking imports in `app.js`.

### Phase 2: Backend Database Decomposition (`src/db/`)
Decompose `src/db.rs` into domain modules while retaining `src/db/mod.rs` so all calls to `crate::db::*` work without breaking changes:
- `src/db/schema.rs`: Database connection configuration, WAL mode setup, table DDL, and migrations.
- `src/db/rooms.rs`: Room creation, lookups, naming, member roles, squad departure settings, and removal.
- `src/db/goals.rs`: Goal querying, auto-routing resolution, goal progress updates, and completion transitions.
- `src/db/activities.rs`: Activity logging, batch insertion, activity query, deletion rollback, cascade, universal sync, and departed contribution purging.
- `src/db/users.rs`: Anonymous user profiles, avatar emoji/colors, streaks, and cryptobiosis state.
- `src/db/prs.rs`: Personal record detection across weight, distance, elevation, and ability feats.
- `src/db/wishlist.rs`: Wishlist submission and retrieval.
- `src/db/mod.rs`: Clean re-exports of all public functions.

### Phase 3: Backend Routes Decomposition (`src/routes/`)
Decompose `src/routes.rs` into logical HTTP handler domains:
- `src/routes/rooms.rs`: Room state, renaming, membership management, departure policies.
- `src/routes/activities.rs`: Activity logging, batch import, deletion, editing.
- `src/routes/goals.rs`: Goal creation, wishlist endpoints.
- `src/routes/users.rs`: Profile management, PR lookup, streak inquiry.
- `src/routes/realtime.rs`: WebSocket hub and cheer broadcasts.
- `src/routes/system.rs`: Server info, QR generation, static PWA assets.
- `src/routes/mod.rs`: Router assembly (`create_router`).

---

## 3. Test Coverage Expansion Strategy

### A. Backend Unit Tests (`src/db/` & `src/models.rs`)
Add unit tests verifying domain edge cases in isolation:
- Metric unit conversions and validation (valid units, illegal numbers, negative values).
- PR calculation engine:
  - Rep maxes vs volume PRs vs raw distance vs elevation.
  - Feat checkoffs and ability completion idempotency.
- User streak logic:
  - Consecutive day tracking.
  - Inactive day threshold and cryptobiosis status.
- Input bounds enforcement:
  - Text length caps (notes, nickname, exercise names).
  - Numeric sanitization and floor boundaries.

### B. Backend Integration Tests (`tests/integration_tests.rs`)
- Test payload validation rejects corrupt activities.
- Test atomic rollback on partial batch failures.
- Test multi-user concurrent squad joining and activity backfilling.
- Test squad departure policy toggling and purge cascades.

### C. Playwright Frontend E2E Tests (`tests/e2e/app.spec.js`)
- Test universal cross-squad workout replication in UI.
- Test private workout isolation (visible only in solo room, never in squad feed).
- Test squad departure purge UI flow.
- Test dedicated share modal vs squad share card.
