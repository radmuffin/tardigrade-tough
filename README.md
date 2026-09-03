# 🦠 Tardigrade Tough

> Collaborative gym & beast tracker with delightful pixel art progress dioramas.

Work together with your gym crew to lift the colossal underground root system of **Pando (13.2M lbs)**, scale **Mt. Everest (29,031 ft)** with mountain goats, trek the **Caribou Arctic Migration (3,000 mi)**, and celebrate past conquests like **The Blue Whale (418,878 lbs)**.

Built on **`fly-common`** (Rust, Axum, SQLite WAL, WebSockets, Anonymous Device Tokens, Zero-Build Vanilla ES6 & CSS).

---

## ✨ Core Features

1. **🌲 Living Pixel Art Dioramas**:
   - **Pando Aspen Grove**: Dynamic autumn canopy blooming with golden foliage and particle leaves on every lift.
   - **Mt. Everest**: Mountain goat scaling rocky ledges and snowy crags as elevation climbs.
   - **Caribou Tundra**: Migrating herd traversing panoramic arctic tundra.
   - **Blue Whale (Trophy Room)**: Deep ocean diorama honoring conquered benchmarks.
2. **📱 3-in-1 Mobile-First Logging Dock**:
   - **⚡ Rapid Stepper**: Rapid set logging with `-45/-10/+10/+45` plate steppers, rep counters, and a single-tap `+1 Same Set` duplicate button.
   - **📋 Full Workout Session**: Multi-exercise batch routine logger.
   - **🚀 Fast-Add**: Fast 1-tap tonnage/distance/elevation punch-in.
3. **🔌 Offline Persistence & Auto-Sync**:
   - Never lose a set in basement gym dead-zones. Workouts queue locally and auto-flush in batches when connectivity returns.
4. **⚡ Realtime Social Feed & Cheers**:
   - WebSockets live updates with floating reaction bursts (`💪`, `🔥`, `🌲`, `🐐`, `🐋`, `🦠`).
5. **🏆 Crew Leaderboard & Co-op Stats**:
   - Daily Tonnage Titan MVP 👑, percentage contribution per lifter, and streak indicators.
6. **👥 Multi-Crew & Solo Rooms with QR Code Pairing**:
   - Scan with your phone to instantly sync devices or join friend groups.

---

## 🚀 Quick Start

### Run Locally
```bash
cargo run
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Deploy to Fly.io
```bash
# Create Fly app
fly launch

# Create persistent storage volume for SQLite
fly volumes create app_data --size 1

# Deploy
fly deploy
```
