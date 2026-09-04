# 🐻 Tardigrade Tough

[![CI](https://github.com/radmuffin/tardigrade-tough/actions/workflows/ci.yml/badge.svg)](https://github.com/radmuffin/tardigrade-tough/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-2021_Edition-orange.svg)](https://www.rust-lang.org/)
[![Axum](https://img.shields.io/badge/Framework-Axum_0.7-blue.svg)](https://github.com/tokio-rs/axum)
[![Fly.io](https://img.shields.io/badge/Deploy-Fly.io-purple.svg)](https://fly.io)

> **Collaborative Gym & Beast Tracker with Living Pixel Art Progress Dioramas.**

Tardigrade Tough allows fitness squads and solo athletes to band together and hoist legendary organisms and landmarks. Work collaboratively to lift the subterranean root clone of **Pando (13.2M lbs)**, climb the vertical elevation of **Mt. Everest (29,031 ft)** with mountain goats, trek the **Caribou Arctic Migration (3,000 miles)**, and celebrate past conquests in the Trophy Room like **The Blue Whale (418,878 lbs)**.

Built on **`fly-common`** using Rust, Axum, SQLite (WAL mode), WebSockets, anonymous device tokens, zero-build vanilla ES6 modules, and responsive CSS custom properties.

---

## 🏛️ System Architecture

```text
 ┌─────────────────────────────────────────────────────────────┐
 │                    Mobile Browser PWA                       │
 │  ┌───────────────────────┐   ┌───────────────────────────┐  │
 │  │ 🌲 Living Pixel Canvas│   │ ⚡ 3-in-1 Workout Dock     │  │
 │  │ (Pando/Everest/Caribou│   │ (Stepper/Session/FastAdd) │  │
 │  └───────────┬───────────┘   └─────────────┬─────────────┘  │
 │              │                             │                │
 │              │      localStorage Queue     │                │
 │              │  (Offline-First Sync Engine)│                │
 └──────────────┼─────────────────────────────┼────────────────┘
                │                             │
        WebSocket Realtime             REST API JSON
        Pub/Sub (Live Cheers)          (Batch & Single Logs)
                │                             │
 ┌──────────────▼─────────────────────────────▼────────────────┐
 │                 Rust Backend (Axum 0.7)                     │
 │  ┌───────────────────────┐   ┌───────────────────────────┐  │
 │  │ BroadcastHub (tokio)  │   │ Security & Input Filtering│  │
 │  │ (Room Pub/Sub events) │   │ (XSS/Length/Range Caps)   │  │
 │  └───────────────────────┘   └─────────────┬─────────────┘  │
 │                                            │                │
 │                              FlyDb Connection Pool          │
 │                                            │                │
 │  ┌─────────────────────────────────────────▼─────────────┐  │
 │  │        SQLite Database (Write-Ahead-Logging)          │  │
 │  │  • rooms   • users   • goals   • activities • wishlist│  │
 │  └───────────────────────────────────────────────────────┘  │
 └─────────────────────────────────────────────────────────────┘
```

---

## ✨ Core Features

1. **🌲 Living Pixel Art Progress Dioramas**:
   - **Pando Aspen Clone**: Golden canopies flourish, saplings sprout, and autumn leaves drift as cumulative tonnage mounts.
   - **Mt. Everest Ascent**: High Himalayan ledges with a nimble mountain goat bounding across rock crags.
   - **Caribou Arctic Migration**: Twilight tundra panoramic landscape with a migrating herd.
   - **🏛️ The Trophy Room (The Blue Whale)**: Deep ocean diorama with sunbeams, bubbles, and victory wreaths celebrating completed mega-beasts (418,878 lbs).

2. **📱 3-in-1 Mobile-First Workout Logger**:
   - **⚡ Rapid Stepper**: Plate steppers (`-45 / -10 / +10 / +45`), rep counters, live calculated impact, and a 1-tap `+1 Same Set` repeater.
   - **📋 Full Workout Session**: Multi-exercise batch routine logger with clean placeholders and quick chips (`+ Squat`, `+ Bench`, `+ Deadlift`, `+ Row`).
   - **🚀 Fast-Add**: 1-tap tonnage/distance/elevation punch-in.

3. **📥 Google Sheets & CSV Backfill Importer**:
   - Copy cells directly from Google Sheets (e.g. `Weight` and `Reps` columns) and paste them in.
   - Live parser preview calculates set counts and total tonnage before 1-click batch import.
   - Assign historical imports to specific friends (*Sally*, *Samantha*, *Brandon*, etc.).

4. **🔌 Offline-First Persistence & Auto-Sync**:
   - Workouts queue locally in `localStorage` during basement gym reception blackouts.
   - Automatically detects connectivity restoration and flushes batches cleanly.

5. **🏆 Crew Leaderboard & Multi-Category Standings**:
   - Filter leaderboard by **All**, **Weight (Tonnage)**, **Distance (Miles)**, and **Elevation (Feet)**.
   - Gold, Silver, and Bronze podiums (🥇 🥈 🥉).
   - **Daily Tonnage Titan** 👑 MVP badge.
   - Detailed individual breakdown of tonnage, distance, elevation, sets, and % contribution.

6. **👥 Multi-Crew, Solo Rooms & Squad Renaming**:
   - Create custom named groups (e.g. *"Sally's Bio Squad"*) or track solo quests.
   - In-place dynamic Squad Renaming (`POST /api/room/:slug/name`) with real-time WebSocket broadcast to all connected crew members.
   - Instant camera pairing with pure-Rust SVG QR codes, 1-click clipboard URL copying, and native mobile Web Share sheet integration.

7. **🔗 Connective Action Navigation**:
   - Seamless inter-screen navigation between Active Quests, Squad Leaderboard, Live Feed, and Trophy Room.
   - 1-tap call-to-action cards jump directly from leaderboards or trophy hall into logging reps.

8. **ℹ️ Lore & Water Bear Philosophy**:
   - Dedicated in-app guide exploring the biology and resilience of tardigrades.
   - Detailed breakdown of all ecological conquest benchmarks (Pando, Everest, Caribou, Blue Whale).

---

## 🚀 Quick Start

### Prerequisites
- [Rust & Cargo](https://rustup.rs/) (1.75+)
- [Node.js](https://nodejs.org/) (for test runner scripts)

### 1. Clone & Run Locally
```bash
git clone https://github.com/radmuffin/tardigrade-tough.git
cd tardigrade-tough

# Run server
cargo run
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser or connect from your phone on your local Wi-Fi / Tailscale.

---

## 💝 Made for Sally

Tardigrade Tough was originally designed and built with love as a personal workout companion for Sally. The goal was simple: replace tedious, sterile spreadsheets with an inspiring, lighthearted fitness quest where every gym session, trail run, and elevation climb moves a shared needle against colossal wonders of the natural world.

---

## 📬 Contact & Connect

- **Creator**: Daniel Spiesman ([@radmuffin](https://github.com/radmuffin))
- **Email**: [danielspiesman@gmail.com](mailto:danielspiesman@gmail.com)
- **GitHub Repository**: [github.com/radmuffin/tardigrade-tough](https://github.com/radmuffin/tardigrade-tough)

---

## 🧪 Testing & CI Tooling

Tardigrade Tough includes a smart affected test runner and comprehensive integration suite:

```bash
# Run affected tests based on git diffs
npm test

# Run all tests, formatting checks, and linters
npm run test:all

# Run Rust formatting
npm run fmt

# Run Clippy linter
npm run lint
```

---

## 🚢 Fly.io Deployment

Tardigrade Tough is packaged in a lightweight multi-stage Docker container (< 25MB runtime):

```bash
# 1. Login to Fly
fly auth login

# 2. Launch application
fly launch

# 3. Create persistent storage volume for SQLite WAL database
fly volumes create app_data --size 1 --region ord

# 4. Deploy
fly deploy
```

---

## 📄 License

Distributed under the [MIT License](LICENSE).
