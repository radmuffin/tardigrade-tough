---
name: 🌲 Quest Proposal
about: Suggest a colossal real-world benchmark or mega-quest for Tardigrade Tough
title: '[Quest Proposal] '
labels: ['quest-proposal']
assignees: radmuffin
---

### 🏋️ Quest Benchmark Overview
- **Quest Title / Landmark**: (e.g. *Hoisting the Golden Gate Bridge*, *Trans-America Trail*, *Mount Olympus Ascent*)
- **Workout Category**: [ ] Weight (Tonnage) / [ ] Distance / [ ] Elevation
- **Target Metric & Unit**: (e.g. `887,000,000 lbs`, `2,900 mi`, `29,032 ft`)
- **Squad / Room**: (optional, e.g. `main` or custom squad slug)

### 📜 Lore & Description
<!-- What makes this landmark, geological formation, or biological organism inspiring? Fun facts about its mass, height, or distance. -->

### 🎨 Suggested Pixel Art / Diorama Theme
<!-- e.g. Suspension Bridge, Redwood Forest, Desert Canyon, Glacier Peaks, Deep Trench -->

### 🚀 Implementation Checklist (Maintainer)
- [ ] Review metric accuracy & unit conversion
- [ ] Select or design canvas pixel art diorama
- [ ] Activate in squad room via `POST /api/goals` or seed globally in `src/db.rs`
