---
name: tardigrade-tough-directives
description: >-
  Enforces UI design minimalism, stylistic preferences, zero-tech-debt engineering standards,
  and autonomous execution workflows for the Tardigrade Tough project.
---

# Tardigrade Tough Development Directives & Standards

This skill codifies the core user preferences and engineering standards for Tardigrade Tough.
Always apply these guidelines when designing interfaces, writing code, refactoring, and planning features.

---

## 1. UI Design & Styling Directives (First-Try Perfection)

### A. Zero Fluff & Minimalism ("If Intuitive, Do Not Explain")
- **Never explain functionality that is already self-evident.**
- Strip away descriptive label filler, e.g.:
  - ❌ "16 vibrant colors" -> Just show the color swatches.
  - ❌ "Auto-routing to Pando..." -> Route silently in logic.
  - ❌ "Choose 1 emoji" -> Just show the emoji input or picker.
  - ❌ "Select your squad from the dropdown below" -> Just the dropdown or list.
- Keep helper notes, subtext, and instructions to an absolute minimum or omit entirely.
- Ensure buttons, badges, and chips use concise, punchy text (1-3 words max).

### B. Compact, Non-Intrusive Layout
- Avoid large controls that consume excessive vertical screen real estate.
- Prefer compact popovers, toggles, or revealable inputs over giant persistent grids.
- Ensure all screens look polished on a standard mobile viewport (390x844 Pixel/iPhone).
- Header elements (squad selector, solo toggle, user profile avatar) must fit neatly without wrapping awkwardly or causing horizontal overflows.

### C. Aesthetic & Theming Cohesion
- Adhere strictly to the established retro pixel art and gaming aesthetic.
- Always utilize CSS custom properties (`--bg-primary`, `--bg-secondary`, `--accent`, `--border`, `--text-primary`, `--text-secondary`).
- Validate both **Dark Mode** (default) and **Light Mode** for contrast, readability, and harmonious accents.
- All diorama additions must respect retro pixel scaling and natural proportions.

---

## 2. Architecture & Backend Standards (Zero Tech Debt)

### A. Multi-Tenant Room Isolation
- Every query must scope by `room_slug` with parameterized statements (`WHERE room_slug = ?`).
- Solo mode (`solo-<token>`) must remain fully isolated from other users' rooms while seamlessly auto-forwarding relevant activities to user squads in the background.

### B. SQLite Transactions & WAL Mode
- Maintain atomic transactional boundaries (`conn.transaction()?`) for multi-step database writes (e.g. logging activity + updating goal values + updating trophies).
- Keep mutex locks on `Arc<Mutex<Connection>>` short and scoped.
- Never write raw unescaped SQL; use `params![]` exclusively.

### C. Zero Memory / Event Listener Leaks
- Any animated canvas or DOM listener engine (like `PixelDiorama`) must implement a clean `destroy()` lifecycle method that cancels `requestAnimationFrame` and removes `window` listeners.

---

## 3. Frontend Standards (Zero-Build Vanilla ES6+)

- Strictly zero-build: no Webpack, Vite, Rollup, or npm bundlers for client-side code.
- Native browser ES6 modules only (`import { FlyToast } from '/_fly/fly-ui.js'`).
- Always escape user inputs with `FlyToast.escape()` or `textContent` to prevent XSS.
- Modularize JS files into single-responsibility modules in `static/js/`.

---

## 4. Autonomous Execution & Testing Protocol

1. **Documented Plans**: Check in plan documents under `docs/plans/` before executing multi-phase initiatives. Update plan documents as features are completed.
2. **Quality Verification**:
   - Format: `cargo fmt --all -- --check`
   - Lint: `cargo clippy --all-targets` (must be 0 warnings)
   - Test: `cargo test --all-targets`
   - Affected runner: `npm run test:affected`
3. **Autonomous Delivery & CI Deploy Pipeline**:
   - Once local affected checks pass cleanly, commit and push immediately to `origin/main` without pausing for extra confirmation.
   - GitHub Actions CI (`.github/workflows/ci.yml`) runs all formatting, linters, backend integration tests, and Playwright E2E tests, and then autonomously deploys to Fly.io.
   - Do NOT run manual local `fly deploy` for commits pushed to `main` to ensure CI executes before deployment and eliminate redundant double deploys.
