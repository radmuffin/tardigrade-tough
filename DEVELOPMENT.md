# 🛠️ Tardigrade Tough - Development & Architecture Guide

> Technical guide, database schema, sheet importing, testing, and deployment instructions for Tardigrade Tough.

---

## 🏛️ System Architecture

Tardigrade Tough is built with **`fly-common`**:
- **Backend**: Rust 2021 + Axum 0.7 + SQLite in Write-Ahead-Logging (WAL) mode.
- **Identity**: Anonymous cryptographic device tokens (`UserToken` / `fly_device_token`) with QR pairing.
- **Realtime Collaboration**: `BroadcastHub` WebSocket pub/sub for instant sync and floating emoji reactions.
- **Frontend**: Zero-build vanilla ES6 Modules + HTML5 2D Canvas Pixel Engine + CSS Custom Properties.
- **Offline Engine**: `OfflineSyncManager` caching sets in `localStorage` with automatic batch synchronization.

---

## 🗄️ Database Schema

SQLite tables initialized in WAL mode:

### 1. `rooms`
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `slug TEXT UNIQUE NOT NULL` (e.g. `main` or `sallys-squad`)
- `name TEXT NOT NULL`
- `created_at TEXT NOT NULL`

### 2. `users`
- `user_token TEXT PRIMARY KEY`
- `nickname TEXT NOT NULL`
- `avatar_color TEXT NOT NULL`
- `current_room_slug TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

### 3. `goals`
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `room_slug TEXT NOT NULL`
- `title TEXT NOT NULL` (e.g. "Pando Aspen Clone", "Caribou Migration", "Mt. Everest")
- `category TEXT NOT NULL` (`weight` | `distance` | `elevation`)
- `target_value REAL NOT NULL`
- `current_value REAL NOT NULL DEFAULT 0`
- `unit TEXT NOT NULL` (`lbs`, `kg`, `mi`, `km`, `ft`, `m`)
- `theme_key TEXT NOT NULL` (`pando`, `everest`, `caribou`, `whale`, `custom`)
- `status TEXT NOT NULL DEFAULT 'active'` (`active` | `completed`)
- `description TEXT NOT NULL`
- `created_at TEXT NOT NULL`

### 4. `activities`
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `room_slug TEXT NOT NULL`
- `user_token TEXT NOT NULL`
- `user_nickname TEXT NOT NULL`
- `user_avatar_color TEXT NOT NULL`
- `goal_id INTEGER REFERENCES goals(id)`
- `activity_type TEXT NOT NULL` (`weight` | `distance` | `elevation`)
- `exercise_name TEXT NOT NULL`
- `sets INTEGER DEFAULT 1`
- `reps INTEGER DEFAULT 1`
- `weight_per_rep REAL DEFAULT 0`
- `distance_val REAL DEFAULT 0`
- `elevation_val REAL DEFAULT 0`
- `total_metric REAL NOT NULL`
- `notes TEXT DEFAULT ''`
- `created_at TEXT NOT NULL`

---

## 📥 Google Sheet Data Importing

Users can copy columns directly from Google Sheets and paste them into the in-app importer (**Activity & Feed** $\rightarrow$ **📥 Import Sheets**):

Supported formats (multi-line, tab / comma / space delimited):
```
10    10
25    10
118   5
208   40
15    20
7.5   80
15    1200
```
- Line with 2 values $\rightarrow$ `Weight` and `Reps` (Calculates `Weight * Reps`)
- Line with 1 value $\rightarrow$ Treated as raw total metric / tonnage
- Assigns the historical sets to whichever member name is specified in the modal.

---

## 🧪 Running Automated Tests

```bash
cargo test
```
All unit and integration tests run in-memory and verify:
- Room creation and goal isolation
- Auto-routing of activities by category
- Batch imports with nickname overrides
- Leaderboard ranking and percent calculations
- Activity deletion and goal rollback

---

## 🚀 Deployment to Fly.io ($0 / mo)

```bash
# 1. Login to Fly.io
fly auth login

# 2. Launch App
fly launch

# 3. Create persistent storage volume for SQLite
fly volumes create app_data --size 1 --region ord

# 4. Deploy
fly deploy
```
The Dockerfile builds a lightweight Debian slim runtime image under 25MB.
