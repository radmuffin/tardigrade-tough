# 🤖 AGENTS.md — AI Agent Guidance for Tardigrade Tough

Welcome, AI Coding Assistant! This document outlines the architecture, database schemas, concurrency rules, security posture, and codebase conventions for **Tardigrade Tough** (Collaborative Gym & Beast Progress Tracker) to help you contribute safely and efficiently.

---

## 🗺️ Project Overview & Architecture

Tardigrade Tough is a real-time collaborative fitness web application built with **`fly-common`**:

- **Language & Runtime**: Rust (2021 edition), Axum (v0.7), and Tokio async runtime.
- **Database**: SQLite via `rusqlite` (bundled feature) running in **Write-Ahead Logging (WAL) mode** with atomic transaction boundaries.
- **Frontend**: Mobile-first Single Page Application (SPA) built using zero-build vanilla ES6+ JS, custom CSS custom properties (dual theme support), and HTML5 2D Canvas for living pixel art progress dioramas.
- **Multi-Device Sync & Identity**: Anonymous cryptographic sync tokens (`X-Device-Token` / `fly_device_token`) allow pairing across devices and sharing collaborative squad rooms via QR codes and unique slugs.
- **Real-Time Pub/Sub**: WebSocket hub (`BroadcastHub` from `fly-common`) broadcasting live activity bursts and tap-to-cheer floating emoji reactions (`💪`, `🔥`, `🌲`, `🐐`, `🐋`, `🐻`).
- **Offline Sync Engine**: `OfflineSyncManager` queues workout sets locally during basement gym connectivity dropouts and automatically syncs in batches upon reconnection.

---

## ⚠️ Critical Coding Guidelines & Gotchas

### 1. Multi-Tenant Room Isolation
All activity logs, goals, and leaderboards are partitioned by `room_slug`:
- Always pass `room_slug` through parameterized SQLite queries (`WHERE room_slug = ?`).
- Actions in one squad (e.g. `sallys-bio-squad`) must never mutate or leak into another squad or solo room (`main`).
- Auto-routing: When a user logs a set without an explicit `goal_id`, the backend automatically resolves the first active goal matching `category` in that user's `room_slug`.

### 2. SQLite Database Transactions & WAL
- Database queries use a shared connection wrapped in `Arc<Mutex<Connection>>` in Axum state.
- Keep transaction locks brief. Since WAL mode is active, reads do not block writes, but concurrent writes serialize.
- Always use parameterized queries (`params![]` / `?`) to eliminate any risk of SQL injection.
- In `log_single_activity`, the activity insert and the goal `current_value` increment execute inside an atomic `conn.transaction()?`. If target is reached, goal status transitions to `'completed'`.

### 3. Security, Input Validation & XSS Prevention
- All user-controlled text rendered into the DOM must pass through `FlyToast.escape()` or `textContent` (never raw unescaped `innerHTML`).
- Input lengths are strictly capped: `nickname` (max 50 chars), `notes` (max 500 chars), `exercise_name` (max 100 chars), `room name` (max 50 chars).
- Numeric values must be bounded: `weight_per_rep >= 0`, `reps >= 1`, `sets >= 1`, `target_value > 0`.
- Deletion authorization: Users can only delete / rollback activity records that match their `user_token`.

### 4. Zero-Build Frontend Conventions & Connective Navigation
- Frontend files in `static/` are served statically by Axum without node bundlers (no webpack/vite).
- Modules use native browser ES6 imports (`import { ... } from '/_fly/fly-ui.js'`).
- Always test responsive mobile viewports (390x844 Pixel/iPhone).
- Do not introduce Node/npm dependencies into client-side JS.
- Inter-screen navigation uses `.connective-btn` with `data-target="<quests|leaderboard|activity|trophy>"` to allow smooth context-switching across views.
- Squad renaming sends `POST /api/room/:slug/name` and emits a WebSocket broadcast `room_renamed` with `{ room: Room }` to sync all connected crew members in real-time.

---

## 🗄️ Database Schemas

### 1. `rooms`
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `slug` (TEXT UNIQUE NOT NULL)
- `name` (TEXT NOT NULL)
- `created_at` (TEXT NOT NULL)

### 2. `users`
- `user_token` (TEXT PRIMARY KEY)
- `nickname` (TEXT NOT NULL)
- `avatar_color` (TEXT NOT NULL)
- `current_room_slug` (TEXT NOT NULL)
- `updated_at` (TEXT NOT NULL)

### 3. `goals`
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `room_slug` (TEXT NOT NULL)
- `title` (TEXT NOT NULL)
- `category` (TEXT NOT NULL) — `'weight'` | `'distance'` | `'elevation'`
- `target_value` (REAL NOT NULL)
- `current_value` (REAL NOT NULL DEFAULT 0.0)
- `unit` (TEXT NOT NULL) — `'lbs'` | `'kg'` | `'mi'` | `'km'` | `'ft'` | `'m'`
- `theme_key` (TEXT NOT NULL) — `'pando'` | `'everest'` | `'caribou'` | `'whale'` | `'custom'`
- `status` (TEXT NOT NULL DEFAULT 'active') — `'active'` | `'completed'`
- `description` (TEXT NOT NULL)
- `created_at` (TEXT NOT NULL)

### 4. `activities`
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `room_slug` (TEXT NOT NULL)
- `user_token` (TEXT NOT NULL)
- `user_nickname` (TEXT NOT NULL)
- `user_avatar_color` (TEXT NOT NULL)
- `goal_id` (INTEGER REFERENCES goals(id))
- `activity_type` (TEXT NOT NULL) — `'weight'` | `'distance'` | `'elevation'`
- `exercise_name` (TEXT NOT NULL)
- `sets` (INTEGER DEFAULT 1)
- `reps` (INTEGER DEFAULT 1)
- `weight_per_rep` (REAL DEFAULT 0.0)
- `distance_val` (REAL DEFAULT 0.0)
- `elevation_val` (REAL DEFAULT 0.0)
- `total_metric` (REAL NOT NULL)
- `notes` (TEXT DEFAULT '')
- `created_at` (TEXT NOT NULL)

### 5. `goal_wishlists`
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `user_token` (TEXT NOT NULL)
- `user_nickname` (TEXT NOT NULL DEFAULT '')
- `room_slug` (TEXT NOT NULL)
- `title` (TEXT NOT NULL)
- `category` (TEXT NOT NULL)
- `target_value` (REAL NOT NULL)
- `unit` (TEXT NOT NULL)
- `notes` (TEXT DEFAULT '')
- `created_at` (TEXT NOT NULL)

---

## ⚡ Agent Testing & Concurrency Protocol

To maximize agent throughput, prevent CPU/memory starvation, and eliminate test flakiness:

> [!IMPORTANT]
> **Agents MUST run the affected test runner before committing.**
>
> 1. **Rapid Local Affected Check (<5s)**:
>    ```bash
>    npm run test:affected
>    ```
>    This evaluates git diffs and runs only impacted Rust test suites, formatting checks, and linters.
>
> 2. **Full End-to-End Suite**:
>    ```bash
>    npm run test:all
>    ```
>
> 3. **Playwright Frontend & E2E Tests**:
>    ```bash
>    npm run test:e2e
>    ```
>
> 4. **Autonomous Commit & Push (No Waiting)**:
>    Once `npm run test:affected` passes cleanly, **commit and push immediately to `origin/main`**.
>    Do not pause or wait for extra confirmation to push when completing requested fixes or features.

---

## 🚀 Key Commands

- **⚡ Fast affected check (Preferred)**: `npm run test:affected`
- **🔬 Full backend test suite**: `cargo test --all-targets`
- **🎭 Playwright E2E tests**: `npm run test:e2e`
- **🦀 Run Clippy linter**: `cargo clippy --all-targets`
- **🎨 Check code formatting**: `cargo fmt --all -- --check`
- **🪝 Install git pre-push hook**: `npm run setup:hooks`
- **🏃 Run local server**: `cargo run`
- **🚢 Deploy to Fly.io**: `fly deploy`
