# 🛡️ Architecture & Execution Plan: Lazy Ironman Composite Goal & Tri-Element Armored Diorama

## 🎯 Overview & Objectives

Add a new composite goal to **Tardigrade Tough**: the **Lazy Ironman** (totaling **140.6 miles** across three disciplines: 2.4 mi swim, 112 mi bike, 26.2 mi marathon run).

### 🚀 Key Multi-Goal Contribution Architecture
Workouts contribute simultaneously across matching active room goals:
- **Running & Biking & Swimming Distance**: Contributes to **both** the active distance goal (**Caribou Migration**, 3,000 mi) **and** the matching leg of **Lazy Ironman** (Swim / Bike / Run)!
- **Elevation Gain**: Any elevation logged during a run or climb contributes to **Mt. Everest Ascent** (29,031 ft)!
- **Distance Inputs by Sub-Type**: Fast-Add and modal loggers provide instant selection of distance discipline: `[ 🏃 Run ]` `[ 🚴 Bike ]` `[ 🏊 Swim ]` with dedicated quick-presets, while Swim Laps continues to provide precise pool length and lap calculation.

---

## 🎨 Creative Diorama Design: Three Armored Champions & Dual Theming

The diorama for `theme_key: 'ironman'` renders a panoramic tri-biome endurance arena that dynamically adapts to both **Light Mode** and **Dark Mode**:

### 🌓 Dual-Theme Environmental Palette
- **☀️ Light Mode (Radiant Coastal Morning Triathlon)**:
  - **Sky**: Crisp cerulean daylight (`#38bdf8`) flowing into warm sunrise gold (`#fef08a` / `#fde047`) on the horizon.
  - **Ocean**: Sparkling Mediterranean azure (`#0284c7` to `#38bdf8`) with white foam crests and sun-glinting wave tips.
  - **Road & Cliffs**: Sun-bleached granite rock cliffs (`#94a3b8` / `#cbd5e1`) and clean slate highway (`#475569`) with vivid white lane lines.
  - **Arch & Armor**: Polished steel with silver glints (`#e2e8f0` highlight, `#64748b` shadow, `#d97706` bronze rivets).
- **🌙 Dark Mode (Iron Forge Twilight & Ember Dusk)**:
  - **Sky**: Deep obsidian night (`#0f172a`) cascading down into warm forge ember glow (`#7c2d12` to `#9a3412` to `#431407`).
  - **Ocean**: Moonlit deep ocean abyss (`#0c4a6e` to `#075985`) with frosted wave crests.
  - **Road & Cliffs**: Basalt cliffs (`#1e293b`) and dark asphalt (`#334155`) with bright reflective lane dashes.
  - **Arch & Armor**: Dark wrought-iron plate (`#1e293b` base, `#475569` edges, glowing orange forge flame reflections).

---

### 🐾 The Three Armored Champions

1. **🏊 Swim Leg (2.4 mi) — The Armored Sea Turtle (`🐢`)**:
   - Glides through coastal ocean waters with animated wave crests, wake trails, and yellow/orange triathlon lane buoys.
   - Equipped with an iron-riveted carapace plate and brass swimming goggles with glowing aqua lenses.
   - Advances across the ocean lane as `swim_progress` increases (0 → 2.4 mi).

2. **🚴 Bike Leg (112.0 mi) — The Armored Jackrabbit Cyclist (`🐇`)**:
   - Races along the winding coastal cliff highway with white dashed lane lines and iron guardrails.
   - Wears an aerodynamic iron aero helmet and iron greaves, pedaling a forged-iron road bike with rotating spoked wheels and kicking up dust puffs as `bike_progress` increases (0 → 112 mi).

3. **🏃 Run Leg (26.2 mi) — The Ironclad Tardigrade (`🐻`)**:
   - The iconic Water Bear in full knight plate armor, complete with shoulder pauldrons, visor helmet, and armored boots.
   - Strides determinedly along the crimson marathon straightaway as `run_progress` increases (0 → 26.2 mi).

4. **🛡️ The Iron / Armor Monument**:
   - A towering **Forged Iron Finish Archway** with glowing flame braziers, iron anvils, and "140.6 IRON" engraved in retro pixel typography.
   - When all three legs are completed, sparks erupt from the forge braziers, victory banners unfurl, and the Ironclad Tardigrade raises its paws in celebration!

