use rusqlite::{params, Connection, Result};

pub fn init_db(conn: &mut Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            creator_token TEXT NOT NULL DEFAULT '',
            keep_departed_contributions INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS users (
            user_token TEXT PRIMARY KEY,
            nickname TEXT NOT NULL,
            avatar_color TEXT NOT NULL,
            avatar_emoji TEXT NOT NULL DEFAULT '',
            current_room_slug TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS room_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_slug TEXT NOT NULL,
            user_token TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            joined_at TEXT NOT NULL,
            UNIQUE(room_slug, user_token)
        );

        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_slug TEXT NOT NULL,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            target_value REAL NOT NULL,
            current_value REAL NOT NULL DEFAULT 0,
            unit TEXT NOT NULL,
            theme_key TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            description TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_slug TEXT NOT NULL,
            user_token TEXT NOT NULL,
            user_nickname TEXT NOT NULL,
            user_avatar_color TEXT NOT NULL,
            user_avatar_emoji TEXT NOT NULL DEFAULT '',
            goal_id INTEGER REFERENCES goals(id),
            activity_type TEXT NOT NULL,
            exercise_name TEXT NOT NULL,
            sets INTEGER DEFAULT 1,
            reps INTEGER DEFAULT 1,
            weight_per_rep REAL DEFAULT 0,
            distance_val REAL DEFAULT 0,
            elevation_val REAL DEFAULT 0,
            total_metric REAL NOT NULL,
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            parent_activity_id INTEGER DEFAULT NULL,
            is_pr INTEGER NOT NULL DEFAULT 0,
            is_combined INTEGER NOT NULL DEFAULT 0,
            is_private INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS goal_wishlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_token TEXT NOT NULL,
            user_nickname TEXT NOT NULL DEFAULT '',
            room_slug TEXT NOT NULL,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            target_value REAL NOT NULL,
            unit TEXT NOT NULL,
            notes TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_goals_room ON goals(room_slug);
        CREATE INDEX IF NOT EXISTS idx_activities_room ON activities(room_slug, id DESC);
        CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_token);
        CREATE INDEX IF NOT EXISTS idx_activities_goal ON activities(goal_id);
        CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_slug);
        CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_token);
    "#,
    )?;

    // Ensure keep_departed_contributions column exists in rooms
    let _ = conn.execute(
        "ALTER TABLE rooms ADD COLUMN keep_departed_contributions INTEGER NOT NULL DEFAULT 1",
        [],
    );

    // Ensure is_private column exists in activities
    let _ = conn.execute(
        "ALTER TABLE activities ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0",
        [],
    );

    // Ensure index on is_private exists
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_activities_private ON activities(is_private)",
        [],
    );

    // Ensure avatar_emoji column exists in users
    let _ = conn.execute(
        "ALTER TABLE users ADD COLUMN avatar_emoji TEXT NOT NULL DEFAULT ''",
        [],
    );

    // Ensure user_avatar_emoji column exists in activities
    let _ = conn.execute(
        "ALTER TABLE activities ADD COLUMN user_avatar_emoji TEXT NOT NULL DEFAULT ''",
        [],
    );

    // Ensure parent_activity_id column exists in activities
    let _ = conn.execute(
        "ALTER TABLE activities ADD COLUMN parent_activity_id INTEGER DEFAULT NULL",
        [],
    );

    // Ensure index on parent_activity_id exists
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_activities_parent ON activities(parent_activity_id)",
        [],
    );

    // Ensure is_pr column exists in activities
    let _ = conn.execute(
        "ALTER TABLE activities ADD COLUMN is_pr INTEGER NOT NULL DEFAULT 0",
        [],
    );

    // Ensure is_combined column exists in activities
    let _ = conn.execute(
        "ALTER TABLE activities ADD COLUMN is_combined INTEGER NOT NULL DEFAULT 0",
        [],
    );

    // Ensure index on user exercise exists for rapid PR lookups
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_activities_user_exercise ON activities(user_token, exercise_name)",
        [],
    );

    // Ensure user_nickname column exists in goal_wishlists for existing tables
    let _ = conn.execute(
        "ALTER TABLE goal_wishlists ADD COLUMN user_nickname TEXT NOT NULL DEFAULT ''",
        [],
    );

    // Ensure creator_token column exists in rooms for existing tables
    let _ = conn.execute(
        "ALTER TABLE rooms ADD COLUMN creator_token TEXT NOT NULL DEFAULT ''",
        [],
    );

    // Backfill room_members from existing users table
    let _ = conn.execute(
        "INSERT OR IGNORE INTO room_members (room_slug, user_token, role, joined_at)
         SELECT current_room_slug, user_token, 'member', updated_at
         FROM users
         WHERE current_room_slug != '' AND user_token != ''",
        [],
    );

    // If room creator is empty, backfill creator_token from first room member (except solo rooms)
    let _ = conn.execute(
        "UPDATE rooms
         SET creator_token = (
             SELECT user_token FROM room_members
             WHERE room_members.room_slug = rooms.slug
             ORDER BY joined_at ASC LIMIT 1
         )
         WHERE (creator_token = '' OR creator_token IS NULL) AND slug NOT LIKE 'solo-%'",
        [],
    );

    // Sync role = 'creator' in room_members for rooms where creator_token is known
    let _ = conn.execute(
        "UPDATE room_members
         SET role = 'creator'
         WHERE user_token = (
             SELECT creator_token FROM rooms
             WHERE rooms.slug = room_members.room_slug AND rooms.creator_token != ''
         )",
        [],
    );

    // Ensure active goals accurately reflect the actual sum of logged activities in that room
    conn.execute(
        r#"UPDATE goals
           SET current_value = (
               SELECT COALESCE(SUM(a.total_metric), 0.0)
               FROM activities a
               WHERE (a.goal_id = goals.id OR (a.goal_id IS NULL AND a.room_slug = goals.room_slug AND a.activity_type = goals.category))
           )
           WHERE status = 'active'"#,
        [],
    )?;

    // Self-heal any goals marked completed where current_value is actually below target_value (e.g. after activity deletions)
    conn.execute(
        "UPDATE goals SET status = 'active' WHERE current_value < target_value AND status = 'completed'",
        [],
    )?;

    Ok(())
}

pub fn seed_room_default_goals(conn: &Connection, slug: &str, now: &str) -> Result<()> {
    conn.execute(
        r#"INSERT INTO goals (room_slug, title, category, target_value, current_value, unit, theme_key, status, description, created_at)
           VALUES (?, 'Pando Aspen Clone', 'weight', 13200000.0, 0.0, 'lbs', 'pando', 'active', 'Hoisting the 13.2-million-pound underground root system of Utah’s massive clonal aspen grove.', ?)"#,
        params![slug, now],
    )?;
    conn.execute(
        r#"INSERT INTO goals (room_slug, title, category, target_value, current_value, unit, theme_key, status, description, created_at)
           VALUES (?, 'Caribou Migration', 'distance', 3000.0, 0.0, 'mi', 'caribou', 'active', 'Running, walking, and biking the majestic 3,000-mile Arctic tundra migration.', ?)"#,
        params![slug, now],
    )?;
    conn.execute(
        r#"INSERT INTO goals (room_slug, title, category, target_value, current_value, unit, theme_key, status, description, created_at)
           VALUES (?, 'Mt. Everest Ascent', 'elevation', 29031.0, 0.0, 'ft', 'everest', 'active', 'Scaling the roof of the world with nimble mountain goats.', ?)"#,
        params![slug, now],
    )?;
    conn.execute(
        r#"INSERT INTO goals (room_slug, title, category, target_value, current_value, unit, theme_key, status, description, created_at)
           VALUES (?, 'The Blue Whale', 'weight', 418878.0, 418878.0, 'lbs', 'whale', 'completed', '🏆 CONQUERED! The crew hoisted the full weight of a colossal Blue Whale.', ?)"#,
        params![slug, now],
    )?;
    Ok(())
}
