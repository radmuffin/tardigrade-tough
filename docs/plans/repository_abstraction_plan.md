# 🏛️ Architecture & Execution Plan: Repository Pattern & Domain Store Abstraction

## 🎯 Motivation & Objectives
Currently, route handlers in `src/routes.rs` interact with `rusqlite` connections directly, locking `state.db.lock().unwrap()` and calling monolithic free functions in `src/db.rs`. Models in `src/models.rs` are plain structs, but database queries across `src/db.rs` parse raw rows using repetitive column index lookups (`row.get(0)?`, `row.get(1)?`, etc.).

To make the system cleaner, adaptable, and extensible:
1. **Domain Store Traits**: Introduce clean storage abstractions (`RoomStore`, `UserStore`, `GoalStore`, `ActivityStore`, and a unified `DataStore`).
2. **Dedicated Row Mappers**: Encapsulate SQL row parsing into reusable mappers in `src/store/mappers.rs`, isolating models from database column offsets and schema drift.
3. **Unified Store Error Handling**: Provide a cohesive `StoreError` type decoupling database errors from HTTP handlers.
4. **SqliteStore Implementation**: Implement the traits on a thread-safe `SqliteStore` that manages connection locking internally.
5. **Route Refactoring**: Update `AppState` and route handlers in `src/routes.rs` to operate via the store abstraction instead of manual mutex locking.
6. **Zero Breaking Changes**: Retain free function compatibility in `src/db.rs` to maintain 100% test suite compatibility across all 25 integration tests.

---

## 🏗️ Architecture Design

```
                     +--------------------------+
                     |       Axum Routes        |
                     +--------------------------+
                                  |
                                  v
+--------------------------------------------------------------------+
|                         Domain Store Traits                        |
|   (RoomStore, UserStore, GoalStore, ActivityStore, DataStore)      |
+--------------------------------------------------------------------+
                                  |
            +---------------------+---------------------+
            |                                           |
            v                                           v
+-------------------------+                 +------------------------+
|       SqliteStore       |                 |     Mock/TestStore     |
| (Manages Arc<Mutex<..>>) |                 | (Extensible Backends)  |
+-------------------------+                 +------------------------+
            |
            v
+-------------------------+
|    Row Mappers (mappers)|
+-------------------------+
            |
            v
+-------------------------+
|     Domain Models       |
|    (src/models.rs)      |
+-------------------------+
```

---

## 📦 Detailed Phases

### Phase 1: Store Module & Domain Traits (`src/store/mod.rs`, `src/store/traits.rs`)
- [ ] Define `StoreError` enum with `rusqlite`, `not_found`, and `internal` variants.
- [ ] Define `StoreResult<T> = Result<T, StoreError>`.
- [ ] Define traits:
  - `RoomStore: Send + Sync`
  - `UserStore: Send + Sync`
  - `GoalStore: Send + Sync`
  - `ActivityStore: Send + Sync`
  - `DataStore: RoomStore + UserStore + GoalStore + ActivityStore + Send + Sync`

### Phase 2: Row Mappers (`src/store/mappers.rs`)
- [ ] Implement row mappers for each model:
  - `map_room(&rusqlite::Row) -> rusqlite::Result<Room>`
  - `map_room_member(&rusqlite::Row) -> rusqlite::Result<RoomMember>`
  - `map_user_squad_summary(&rusqlite::Row) -> rusqlite::Result<UserSquadSummary>`
  - `map_user_profile(&rusqlite::Row) -> rusqlite::Result<UserProfile>`
  - `map_goal(&rusqlite::Row) -> rusqlite::Result<Goal>`
  - `map_activity(&rusqlite::Row) -> rusqlite::Result<Activity>`
  - `map_personal_record(&rusqlite::Row) -> rusqlite::Result<PersonalRecord>`
  - `map_wishlist_item(&rusqlite::Row) -> rusqlite::Result<GoalWishlistItem>`
  - `map_leaderboard_member(&rusqlite::Row) -> rusqlite::Result<LeaderboardMember>`

### Phase 3: SqliteStore Implementation (`src/store/sqlite.rs`)
- [ ] Implement `SqliteStore` holding `Arc<Mutex<rusqlite::Connection>>`.
- [ ] Implement `RoomStore`, `UserStore`, `GoalStore`, `ActivityStore` for `SqliteStore`.
- [ ] Encapsulate internal mutex locking, transactions, and error propagation.

### Phase 4: AppState & Routes Modernization (`src/lib.rs`, `src/routes.rs`)
- [ ] Add `store: Arc<dyn DataStore>` (or `Arc<SqliteStore>`) to `AppState`.
- [ ] Refactor `src/routes.rs` handlers to utilize `state.store` cleanly.
- [ ] Ensure `src/db.rs` re-exports or delegates so existing external consumers/tests remain 100% operational.

### Phase 5: Verification & Quality Checks
- [ ] Verify formatting with `cargo fmt --all -- --check`.
- [ ] Verify zero warnings with `cargo clippy --all-targets`.
- [ ] Run full test suite with `cargo test --all-targets`.
- [ ] Run `npm run test:affected`.
- [ ] Autonomous commit and push to `origin/main`.
- [ ] Deploy to Fly.io via `fly deploy` and test live health endpoint.

---

## 📈 Execution Log
- **2026-09-05**: User selected Repository Pattern with Domain Store Traits. Architecture plan created and checked in.
