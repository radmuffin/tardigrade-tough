# Admin Succession, Role Promotion/Demotion & Squad Deletion

## Overview
This initiative implements robust admin lifecycle management for Tardigrade Tough squads:
1. **Admin Succession on Departure**: When a squad creator or admin leaves the squad, ownership/admin privileges automatically transfer to the next most senior squad member (`joined_at ASC`).
2. **Role Promotion & Demotion**:
   - Squad creators and admins can promote any regular member to an admin.
   - Squad creators can demote an admin back to a regular member.
   - Regular admins **cannot** demote other admins.
   - Regular admins can remove regular members, but **only creators** can remove an admin.
3. **Self-Healing Succession**: Existing orphaned or abandoned squads in SQLite (e.g. where the creator departed before succession was implemented) are automatically self-healed on startup and roster load by promoting the most senior member to admin.
4. **Squad Deletion**:
   - Any squad admin (or creator) can permanently delete a custom squad.
   - Atomic SQLite transaction purges all associated activities, goals, wishlists, and memberships.
   - All active users currently viewing the deleted squad are automatically redirected back to their private solo room, and a `room_deleted` WebSocket event notifies all connected squad members in real-time.
   - Solo rooms (`solo-<token>`) are protected from deletion.

---

## Architectural Changes

### Database & Schema
- `rooms.creator_token`: Ensured non-empty on room creation; backfilled if empty.
- `room_members.role`: Values `'creator'` | `'admin'` | `'member'`.
- Self-healing migrations in `src/db/schema.rs` and dynamic promotion via `ensure_admin_succession` in `src/db/rooms.rs`.
- Atomic deletion routine `delete_room` in `src/db/rooms.rs`.

### Backend Models & Routes
- `RoomMember` & `UserSquadSummary`: Added `#[serde(default)] pub is_admin: bool`.
- `UpdateMemberRoleRequest`: `pub role: String`.
- `DeleteRoomResponse`: `pub deleted_slug: String`.
- `DELETE /room/:slug` & `POST /room/:slug/delete`: Handled with permissions checks (`is_room_admin`), cascades database cleanup, and broadcasts `room_deleted`.
- `POST /room/:slug/members/:token/role`: Handled with role hierarchy rules (`creator` can demote admin; regular admin cannot demote admin), updates role, and broadcasts `member_role_updated`.

### Frontend UI & Real-Time Sync
- **Squad Hub Modal (`static/js/modals/hub.js`)**:
  - Dynamically determines if the current viewing user is an admin or creator.
  - Renders `+ Admin` promotion buttons for members, and `Remove Admin` for creators.
  - In `squadOwnerSettingsCard`, provides a red `Delete Squad` button with a confirm dialog.
  - Redirects to `/` immediately upon successful deletion.
- **Real-Time Client (`static/js/realtime.js`)**:
  - Listens for `room_deleted`: shows an alert toast and redirects the user back to `/` if they are currently viewing the deleted room.
  - Listens for `member_role_updated`: displays a toast and refreshes the room roster.
