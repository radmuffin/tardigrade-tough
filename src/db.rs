use crate::models::*;
use crate::store::mappers::*;
use chrono::{Duration, NaiveDate, Utc};
use rusqlite::{params, Connection, Result};

pub fn init_db(conn: &mut Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            creator_token TEXT NOT NULL DEFAULT ''
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
            parent_activity_id INTEGER DEFAULT NULL
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

pub fn get_or_create_room(conn: &Connection, slug: &str) -> Result<Room> {
    let mut stmt =
        conn.prepare("SELECT id, slug, name, created_at, creator_token FROM rooms WHERE slug = ?")?;
    let found = stmt.query_row(params![slug], map_room);

    match found {
        Ok(room) => Ok(room),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            let now = Utc::now().to_rfc3339();
            let pretty_name = if slug.starts_with("solo-") {
                "Solo Quest".to_string()
            } else {
                format!("{} Crew", slug.replace('-', " "))
            };
            conn.execute(
                "INSERT INTO rooms (slug, name, created_at, creator_token) VALUES (?, ?, ?, '')",
                params![slug, pretty_name, now],
            )?;
            let id = conn.last_insert_rowid();

            // Seed initial goals for newly created rooms
            seed_room_default_goals(conn, slug, &now)?;

            Ok(Room {
                id,
                slug: slug.to_string(),
                name: pretty_name,
                created_at: now,
                creator_token: String::new(),
            })
        }
        Err(e) => Err(e),
    }
}

pub fn update_room_name(conn: &Connection, slug: &str, new_name: &str) -> Result<Room> {
    let clean_name = new_name.trim();
    if clean_name.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName(
            "Room name cannot be empty".to_string(),
        ));
    }
    let truncated_name = if clean_name.chars().count() > 50 {
        clean_name.chars().take(50).collect::<String>()
    } else {
        clean_name.to_string()
    };

    // Ensure room exists first
    let _ = get_or_create_room(conn, slug)?;

    conn.execute(
        "UPDATE rooms SET name = ? WHERE slug = ?",
        params![truncated_name, slug],
    )?;

    get_or_create_room(conn, slug)
}

pub fn ensure_room_member(conn: &Connection, room_slug: &str, user_token: &str) -> Result<()> {
    let tok = user_token.trim();
    if tok.is_empty() {
        return Ok(());
    }

    let creator_token: String = conn
        .query_row(
            "SELECT COALESCE(creator_token, '') FROM rooms WHERE slug = ?",
            params![room_slug],
            |r| r.get(0),
        )
        .unwrap_or_default();

    let mut role = "member";
    if creator_token.is_empty() && !room_slug.starts_with("solo-") {
        let _ = conn.execute(
            "UPDATE rooms SET creator_token = ? WHERE slug = ?",
            params![tok, room_slug],
        );
        role = "creator";
    } else if creator_token == tok || room_slug.starts_with("solo-") {
        role = "creator";
    }

    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO room_members (room_slug, user_token, role, joined_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(room_slug, user_token) DO UPDATE SET role = CASE WHEN room_members.role = 'creator' THEN 'creator' ELSE excluded.role END",
        params![room_slug, tok, role, now],
    )?;

    Ok(())
}

pub fn get_room_members(conn: &Connection, room_slug: &str) -> Result<Vec<RoomMember>> {
    // Backfill any users currently assigned to this room who aren't yet in room_members
    let _ = conn.execute(
        "INSERT OR IGNORE INTO room_members (room_slug, user_token, role, joined_at)
         SELECT current_room_slug, user_token, 'member', updated_at
         FROM users
         WHERE current_room_slug = ? AND user_token != ''",
        params![room_slug],
    );

    let room_creator: String = conn
        .query_row(
            "SELECT COALESCE(creator_token, '') FROM rooms WHERE slug = ?",
            params![room_slug],
            |r| r.get(0),
        )
        .unwrap_or_default();

    let mut stmt = conn.prepare(
        r#"
        SELECT
            rm.user_token,
            COALESCE(u.nickname, 'Athlete') AS nickname,
            COALESCE(u.avatar_color, '#10b981') AS avatar_color,
            COALESCE(u.avatar_emoji, '') AS avatar_emoji,
            rm.role,
            rm.joined_at,
            COALESCE((SELECT SUM(a.total_metric) FROM activities a WHERE a.room_slug = rm.room_slug AND a.user_token = rm.user_token), 0.0) AS total_metric,
            COALESCE((SELECT COUNT(*) FROM activities a WHERE a.room_slug = rm.room_slug AND a.user_token = rm.user_token), 0) AS total_sets
        FROM room_members rm
        LEFT JOIN users u ON u.user_token = rm.user_token
        WHERE rm.room_slug = ?
        ORDER BY (rm.user_token = ? OR rm.role = 'creator') DESC, rm.joined_at ASC
    "#,
    )?;

    let rows = stmt.query_map(params![room_slug, room_creator], |row| {
        let user_token: String = row.get(0)?;
        let nickname: String = row.get(1)?;
        let avatar_color: String = row.get(2)?;
        let avatar_emoji: String = row.get(3)?;
        let db_role: String = row.get(4)?;
        let joined_at: String = row.get(5)?;
        let total_metric: f64 = row.get(6)?;
        let total_sets: i64 = row.get(7)?;

        let is_creator = (user_token == room_creator && !room_creator.is_empty())
            || db_role == "creator"
            || room_slug.starts_with("solo-");
        let role = if is_creator {
            "creator".to_string()
        } else {
            "member".to_string()
        };

        Ok(RoomMember {
            user_token,
            nickname,
            avatar_color,
            avatar_emoji,
            role,
            is_creator,
            joined_at,
            total_metric,
            total_sets,
        })
    })?;

    let mut members = Vec::new();
    for m in rows {
        members.push(m?);
    }
    Ok(members)
}

pub fn leave_room(conn: &Connection, room_slug: &str, user_token: &str) -> Result<String> {
    let _ = conn.execute(
        "DELETE FROM room_members WHERE room_slug = ? AND user_token = ?",
        params![room_slug, user_token],
    );

    let solo_slug = generate_solo_room_slug(user_token);
    conn.execute(
        "UPDATE users SET current_room_slug = ? WHERE user_token = ?",
        params![solo_slug, user_token],
    )?;

    // If leaving user was the room creator, transfer ownership to next member
    let room_creator: String = conn
        .query_row(
            "SELECT COALESCE(creator_token, '') FROM rooms WHERE slug = ?",
            params![room_slug],
            |r| r.get(0),
        )
        .unwrap_or_default();

    if room_creator == user_token {
        let mut next_stmt = conn.prepare(
            "SELECT user_token FROM room_members WHERE room_slug = ? ORDER BY joined_at ASC LIMIT 1",
        )?;
        let next_owner: rusqlite::Result<String> =
            next_stmt.query_row(params![room_slug], |r| r.get(0));

        if let Ok(new_creator) = next_owner {
            conn.execute(
                "UPDATE rooms SET creator_token = ? WHERE slug = ?",
                params![new_creator, room_slug],
            )?;
            conn.execute(
                "UPDATE room_members SET role = 'creator' WHERE room_slug = ? AND user_token = ?",
                params![room_slug, new_creator],
            )?;
        } else {
            conn.execute(
                "UPDATE rooms SET creator_token = '' WHERE slug = ?",
                params![room_slug],
            )?;
        }
    }

    Ok(solo_slug)
}

pub fn remove_room_member(
    conn: &Connection,
    room_slug: &str,
    creator_token: &str,
    target_token: &str,
) -> std::result::Result<String, String> {
    let current_creator: String = conn
        .query_row(
            "SELECT COALESCE(creator_token, '') FROM rooms WHERE slug = ?",
            params![room_slug],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    if current_creator != creator_token {
        return Err("Only the squad creator can remove members from this squad".to_string());
    }

    if creator_token == target_token {
        return Err("Squad creator cannot remove themselves; use leave squad instead".to_string());
    }

    conn.execute(
        "DELETE FROM room_members WHERE room_slug = ? AND user_token = ?",
        params![room_slug, target_token],
    )
    .map_err(|e| e.to_string())?;

    let solo_slug = generate_solo_room_slug(target_token);
    conn.execute(
        "UPDATE users SET current_room_slug = ? WHERE user_token = ? AND current_room_slug = ?",
        params![solo_slug, target_token, room_slug],
    )
    .map_err(|e| e.to_string())?;

    Ok(solo_slug)
}

pub fn create_room_for_user(
    conn: &Connection,
    user_token: &str,
    name: Option<&str>,
) -> Result<Room> {
    let tok = user_token.trim();
    let default_room = generate_solo_room_slug(tok);
    let user_profile = get_or_create_user(conn, tok, &default_room)?;

    let nick = user_profile.nickname.trim();
    let fallback_name = if !nick.is_empty() && nick != "Athlete" {
        format!("{}'s Squad", nick)
    } else {
        "Pando Squad".to_string()
    };

    let chosen_name = name
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .unwrap_or(&fallback_name);

    let base_slug = chosen_name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>();
    let clean_base = base_slug.trim_matches('-').replace("--", "-");
    let clean_base = if clean_base.is_empty() {
        "squad".to_string()
    } else {
        clean_base
    };
    let random_suffix = &fly_common::sync::generate_share_token()[..4];
    let slug = format!("{}-{}", clean_base, random_suffix);

    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO rooms (slug, name, created_at, creator_token) VALUES (?, ?, ?, ?)",
        params![slug, chosen_name, now, tok],
    )?;
    let id = conn.last_insert_rowid();

    // Seed initial goals for newly created rooms
    seed_room_default_goals(conn, &slug, &now)?;

    if !tok.is_empty() {
        conn.execute(
            "INSERT OR REPLACE INTO room_members (room_slug, user_token, role, joined_at) VALUES (?, ?, 'creator', ?)",
            params![slug, tok, now],
        )?;

        conn.execute(
            "UPDATE users SET current_room_slug = ? WHERE user_token = ?",
            params![slug, tok],
        )?;
    }

    Ok(Room {
        id,
        slug,
        name: chosen_name.to_string(),
        created_at: now,
        creator_token: tok.to_string(),
    })
}

pub fn get_user_squads(conn: &Connection, user_token: &str) -> Result<Vec<UserSquadSummary>> {
    let tok = user_token.trim();
    if tok.is_empty() {
        return Ok(Vec::new());
    }

    let mut stmt = conn.prepare(
        r#"
        SELECT
            r.slug,
            r.name,
            rm.role,
            (r.creator_token = ? OR rm.role = 'creator') AS is_creator,
            (SELECT COUNT(*) FROM room_members rm2 WHERE rm2.room_slug = r.slug) AS member_count,
            rm.joined_at
        FROM room_members rm
        JOIN rooms r ON r.slug = rm.room_slug
        WHERE rm.user_token = ? AND r.slug NOT LIKE 'solo-%'
        ORDER BY rm.joined_at DESC
    "#,
    )?;

    let rows = stmt.query_map(params![tok, tok], map_user_squad_summary)?;

    let mut squads = Vec::new();
    for s in rows {
        squads.push(s?);
    }
    Ok(squads)
}

pub fn get_user_current_room(conn: &Connection, token: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT current_room_slug FROM users WHERE user_token = ?")?;
    let mut rows = stmt.query(params![token])?;
    if let Some(row) = rows.next()? {
        let slug: String = row.get(0)?;
        Ok(Some(slug))
    } else {
        Ok(None)
    }
}

pub fn generate_solo_room_slug(token: &str) -> String {
    let sanitized: String = token
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    if sanitized.is_empty() {
        return format!("solo-{}", &fly_common::sync::generate_share_token()[..8]);
    }

    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    sanitized.hash(&mut hasher);
    let hash = hasher.finish();
    format!("solo-{:06x}", hash & 0xFFFFFF)
}

pub fn calculate_user_streak(conn: &Connection, user_token: &str) -> (i32, String) {
    let mut stmt = match conn.prepare(
        "SELECT DISTINCT SUBSTR(created_at, 1, 10) as day
         FROM activities
         WHERE user_token = ?
         ORDER BY day DESC",
    ) {
        Ok(s) => s,
        Err(_) => return (0, "cryptobiosis".to_string()),
    };

    let rows: Vec<String> = stmt
        .query_map(params![user_token], |r| r.get(0))
        .map(|mapped| mapped.filter_map(Result::ok).collect())
        .unwrap_or_default();

    if rows.is_empty() {
        return (0, "cryptobiosis".to_string());
    }

    let today = Utc::now().date_naive();
    let yesterday = today - Duration::days(1);

    let most_recent = match NaiveDate::parse_from_str(&rows[0], "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return (0, "cryptobiosis".to_string()),
    };

    if most_recent < yesterday {
        return (0, "cryptobiosis".to_string());
    }

    let mut streak = 0;
    let mut expected_date = most_recent;

    for date_str in &rows {
        if let Ok(d) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            if d == expected_date {
                streak += 1;
                expected_date -= Duration::days(1);
            } else if d < expected_date {
                break;
            }
        }
    }

    let state = if streak > 0 {
        "hydrated".to_string()
    } else {
        "cryptobiosis".to_string()
    };

    (streak, state)
}

pub fn get_or_create_user(
    conn: &Connection,
    token: &str,
    default_room: &str,
) -> Result<UserProfile> {
    let (streak_days, tardigrade_state) = calculate_user_streak(conn, token);
    let mut stmt = conn.prepare(
        "SELECT user_token, nickname, avatar_color, COALESCE(avatar_emoji, ''), current_room_slug, updated_at FROM users WHERE user_token = ?",
    )?;
    let found = stmt.query_row(params![token], |row| {
        Ok(UserProfile {
            user_token: row.get(0)?,
            nickname: row.get(1)?,
            avatar_color: row.get(2)?,
            avatar_emoji: row.get(3)?,
            current_room_slug: row.get(4)?,
            updated_at: row.get(5)?,
            streak_days,
            tardigrade_state: tardigrade_state.clone(),
        })
    });

    match found {
        Ok(user) => Ok(user),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            let default_names = [
                "GymBeast",
                "IronTardigrade",
                "PandoLifter",
                "MountainGoat",
                "CaribouRunner",
            ];
            let default_colors = [
                "#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#14b8a6",
                "#6366f1", "#d946ef", "#f43f5e", "#84cc16", "#eab308", "#f97316", "#0ea5e9",
                "#a855f7", "#22c55e",
            ];
            let default_emojis = [
                "🐻", "🦔", "🌲", "🐐", "🐋", "🦾", "⚡", "🏋️", "🦍", "🦅", "🦁", "🐯",
            ];

            // Derive consistent index from token hash
            let hash: usize = token.bytes().map(|b| b as usize).sum();
            let nickname = format!(
                "{}_{}",
                default_names[hash % default_names.len()],
                &token[..4.min(token.len())]
            );
            let avatar_color = default_colors[hash % default_colors.len()].to_string();
            let avatar_emoji = default_emojis[hash % default_emojis.len()].to_string();
            let now = Utc::now().to_rfc3339();

            conn.execute(
                "INSERT INTO users (user_token, nickname, avatar_color, avatar_emoji, current_room_slug, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                params![token, nickname, avatar_color, avatar_emoji, default_room, now],
            )?;

            Ok(UserProfile {
                user_token: token.to_string(),
                nickname,
                avatar_color,
                avatar_emoji,
                current_room_slug: default_room.to_string(),
                updated_at: now,
                streak_days,
                tardigrade_state,
            })
        }
        Err(e) => Err(e),
    }
}

pub fn update_user_profile(
    conn: &Connection,
    token: &str,
    req: &UpdateProfileRequest,
) -> Result<UserProfile> {
    let default_room = generate_solo_room_slug(token);
    let current = get_or_create_user(conn, token, &default_room)?;
    let nickname = req.nickname.as_deref().unwrap_or(&current.nickname).trim();
    let nickname = if nickname.is_empty() {
        current.nickname.as_str()
    } else {
        nickname
    };
    let color = req.avatar_color.as_deref().unwrap_or(&current.avatar_color);
    let emoji = match &req.avatar_emoji {
        Some(e) => {
            let trimmed = e.trim();
            trimmed.chars().take(8).collect::<String>()
        }
        None => current.avatar_emoji.clone(),
    };
    let room = req
        .current_room_slug
        .as_deref()
        .unwrap_or(&current.current_room_slug);
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE users SET nickname = ?, avatar_color = ?, avatar_emoji = ?, current_room_slug = ?, updated_at = ? WHERE user_token = ?",
        params![nickname, color, emoji, room, now, token],
    )?;

    let (streak_days, tardigrade_state) = calculate_user_streak(conn, token);

    Ok(UserProfile {
        user_token: token.to_string(),
        nickname: nickname.to_string(),
        avatar_color: color.to_string(),
        avatar_emoji: emoji,
        current_room_slug: room.to_string(),
        updated_at: now,
        streak_days,
        tardigrade_state,
    })
}

pub fn get_user_personal_records(
    conn: &Connection,
    user_token: &str,
) -> Result<Vec<PersonalRecord>> {
    let mut stmt = conn.prepare(
        r#"SELECT 
            exercise_name,
            activity_type,
            MAX(weight_per_rep) AS max_weight,
            MAX(reps) AS max_reps,
            MAX(distance_val) AS max_distance,
            MAX(elevation_val) AS max_elevation
         FROM activities
         WHERE user_token = ?
         GROUP BY LOWER(TRIM(exercise_name)), activity_type
         ORDER BY MAX(weight_per_rep) DESC, MAX(distance_val) DESC, MAX(elevation_val) DESC
         LIMIT 10"#,
    )?;

    let rows = stmt.query_map(params![user_token], map_personal_record)?;

    Ok(rows.filter_map(Result::ok).collect())
}

pub fn get_goals_for_room(conn: &Connection, room_slug: &str) -> Result<(Vec<Goal>, Vec<Goal>)> {
    // Ensure any goal whose current_value is below target is active
    let _ = conn.execute(
        "UPDATE goals SET status = 'active' WHERE room_slug = ? AND current_value < target_value AND status = 'completed'",
        params![room_slug],
    );

    let mut stmt = conn.prepare(
        "SELECT id, room_slug, title, category, target_value, current_value, unit, theme_key, status, description, created_at
         FROM goals WHERE room_slug = ? ORDER BY id ASC",
    )?;

    let mut active = Vec::new();
    let mut completed = Vec::new();

    let rows = stmt.query_map(params![room_slug], map_goal)?;

    for g in rows.flatten() {
        if g.status == "completed" {
            completed.push(g);
        } else {
            active.push(g);
        }
    }

    Ok((active, completed))
}

pub fn log_single_activity(
    conn: &mut Connection,
    user: &UserProfile,
    room_slug: &str,
    req: &LogActivityRequest,
) -> Result<Activity> {
    get_or_create_room(conn, room_slug)?;
    let tx = conn.transaction()?;

    let activity_type = req.activity_type.trim().to_lowercase();
    let sets = req.sets.unwrap_or(1).max(1);
    let reps = req.reps.unwrap_or(1).max(1);
    let weight_per_rep = req.weight_per_rep.unwrap_or(0.0).max(0.0);
    let distance_val = req.distance_val.unwrap_or(0.0).max(0.0);
    let elevation_val = req.elevation_val.unwrap_or(0.0).max(0.0);

    let total_metric = if let Some(explicit) = req.total_metric {
        explicit.max(0.0)
    } else {
        match activity_type.as_str() {
            "weight" => (sets as f64) * (reps as f64) * weight_per_rep,
            "distance" => distance_val,
            "elevation" => elevation_val,
            _ => {
                if weight_per_rep > 0.0 {
                    (sets as f64) * (reps as f64) * weight_per_rep
                } else if distance_val > 0.0 {
                    distance_val
                } else if elevation_val > 0.0 {
                    elevation_val
                } else {
                    (sets as f64) * (reps as f64)
                }
            }
        }
    };

    let exercise_name = req
        .exercise_name
        .as_deref()
        .unwrap_or(match activity_type.as_str() {
            "weight" => "Lift",
            "distance" => "Cardio",
            "elevation" => "Climb",
            _ => "Workout",
        })
        .trim();

    // Auto-route to matching active goal for this category if goal_id not specified
    let mut goal_id = req.goal_id;
    if goal_id.is_none() {
        let mut goal_stmt = tx.prepare(
            "SELECT id FROM goals WHERE room_slug = ? AND category = ? AND status = 'active' ORDER BY id ASC LIMIT 1",
        )?;
        goal_id = goal_stmt
            .query_row(params![room_slug, activity_type], |r| r.get(0))
            .ok();
    }

    // Update the goal progress
    if let Some(gid) = goal_id {
        tx.execute(
            "UPDATE goals SET current_value = current_value + ? WHERE id = ?",
            params![total_metric, gid],
        )?;

        // Check if goal completed
        let is_completed = {
            let mut check_stmt =
                tx.prepare("SELECT current_value, target_value FROM goals WHERE id = ?")?;
            if let Ok((cur, tgt)) = check_stmt.query_row(params![gid], |r| {
                Ok((r.get::<_, f64>(0)?, r.get::<_, f64>(1)?))
            }) {
                cur >= tgt && tgt > 0.0
            } else {
                false
            }
        };

        if is_completed {
            tx.execute(
                "UPDATE goals SET status = 'completed' WHERE id = ?",
                params![gid],
            )?;
        }
    }

    let now = Utc::now().to_rfc3339();
    let activity_time = req.created_at.as_deref().unwrap_or(&now);
    let nickname = req.user_nickname.as_deref().unwrap_or(&user.nickname);
    let avatar_color = req
        .user_avatar_color
        .as_deref()
        .unwrap_or(&user.avatar_color);
    let avatar_emoji = req
        .user_avatar_emoji
        .as_deref()
        .unwrap_or(&user.avatar_emoji);
    let notes = req.notes.as_deref().unwrap_or("").trim();
    let parent_activity_id = req.parent_activity_id;

    let is_pr = if let Some(explicit_pr) = req.is_pr {
        explicit_pr
    } else {
        let clean_exercise = exercise_name.trim().to_lowercase();
        match activity_type.as_str() {
            "weight" => {
                if weight_per_rep > 0.0 {
                    let prev_max: f64 = tx
                        .query_row(
                            "SELECT COALESCE(MAX(weight_per_rep), 0.0) FROM activities WHERE user_token = ? AND LOWER(TRIM(exercise_name)) = ?",
                            params![user.user_token, clean_exercise],
                            |r| r.get(0),
                        )
                        .unwrap_or(0.0);
                    weight_per_rep > prev_max
                } else {
                    let prev_max_reps: i32 = tx
                        .query_row(
                            "SELECT COALESCE(MAX(reps), 0) FROM activities WHERE user_token = ? AND LOWER(TRIM(exercise_name)) = ? AND weight_per_rep = 0.0",
                            params![user.user_token, clean_exercise],
                            |r| r.get(0),
                        )
                        .unwrap_or(0);
                    reps > prev_max_reps
                }
            }
            "distance" if distance_val > 0.0 => {
                let prev_max: f64 = tx
                    .query_row(
                        "SELECT COALESCE(MAX(distance_val), 0.0) FROM activities WHERE user_token = ? AND LOWER(TRIM(exercise_name)) = ?",
                        params![user.user_token, clean_exercise],
                        |r| r.get(0),
                    )
                    .unwrap_or(0.0);
                distance_val > prev_max
            }
            "elevation" if elevation_val > 0.0 => {
                let prev_max: f64 = tx
                    .query_row(
                        "SELECT COALESCE(MAX(elevation_val), 0.0) FROM activities WHERE user_token = ? AND LOWER(TRIM(exercise_name)) = ?",
                        params![user.user_token, clean_exercise],
                        |r| r.get(0),
                    )
                    .unwrap_or(0.0);
                elevation_val > prev_max
            }
            _ => false,
        }
    };

    tx.execute(
        r#"INSERT INTO activities 
           (room_slug, user_token, user_nickname, user_avatar_color, user_avatar_emoji, goal_id, activity_type, exercise_name, sets, reps, weight_per_rep, distance_val, elevation_val, total_metric, notes, created_at, parent_activity_id, is_pr)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        params![
            room_slug,
            user.user_token,
            nickname,
            avatar_color,
            avatar_emoji,
            goal_id,
            activity_type,
            exercise_name,
            sets,
            reps,
            weight_per_rep,
            distance_val,
            elevation_val,
            total_metric,
            notes,
            activity_time,
            parent_activity_id,
            if is_pr { 1 } else { 0 }
        ],
    )?;

    let id = tx.last_insert_rowid();
    tx.commit()?;

    Ok(Activity {
        id,
        room_slug: room_slug.to_string(),
        user_token: user.user_token.clone(),
        user_nickname: nickname.to_string(),
        user_avatar_color: avatar_color.to_string(),
        user_avatar_emoji: avatar_emoji.to_string(),
        goal_id,
        activity_type,
        exercise_name: exercise_name.to_string(),
        sets,
        reps,
        weight_per_rep,
        distance_val,
        elevation_val,
        total_metric,
        notes: notes.to_string(),
        created_at: activity_time.to_string(),
        parent_activity_id,
        is_pr,
    })
}

pub fn delete_activity(
    conn: &mut Connection,
    activity_id: i64,
    user_token: &str,
) -> Result<Option<Vec<String>>> {
    let tx = conn.transaction()?;

    let found = {
        let mut stmt = tx.prepare(
            "SELECT goal_id, total_metric, user_token, room_slug FROM activities WHERE id = ?",
        )?;
        stmt.query_row(params![activity_id], |r| {
            Ok((
                r.get::<_, Option<i64>>(0)?,
                r.get::<_, f64>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })
    };

    if let Ok((goal_id, total_metric, owner_token, room_slug)) = found {
        // Only owner can delete
        if owner_token != user_token {
            return Ok(None);
        }

        let mut affected_rooms = vec![room_slug];

        // Find any child activities forwarded from this parent activity
        let child_rows = {
            let mut child_stmt = tx.prepare(
                "SELECT id, goal_id, total_metric, room_slug FROM activities WHERE parent_activity_id = ? AND user_token = ?",
            )?;
            let rows = child_stmt
                .query_map(params![activity_id, user_token], |r| {
                    Ok((
                        r.get::<_, i64>(0)?,
                        r.get::<_, Option<i64>>(1)?,
                        r.get::<_, f64>(2)?,
                        r.get::<_, String>(3)?,
                    ))
                })?
                .filter_map(Result::ok)
                .collect::<Vec<_>>();
            rows
        };

        for (c_id, c_goal_id, c_metric, c_room) in child_rows {
            if let Some(gid) = c_goal_id {
                tx.execute(
                    "UPDATE goals SET current_value = MAX(0, current_value - ?) WHERE id = ?",
                    params![c_metric, gid],
                )?;
                tx.execute(
                    "UPDATE goals SET status = 'active' WHERE id = ? AND current_value < target_value AND status = 'completed'",
                    params![gid],
                )?;
            }
            tx.execute("DELETE FROM activities WHERE id = ?", params![c_id])?;
            if !affected_rooms.contains(&c_room) {
                affected_rooms.push(c_room);
            }
        }

        if let Some(gid) = goal_id {
            tx.execute(
                "UPDATE goals SET current_value = MAX(0, current_value - ?) WHERE id = ?",
                params![total_metric, gid],
            )?;

            // Re-evaluate goal status: if current_value dropped below target_value, revert to 'active'
            tx.execute(
                "UPDATE goals SET status = 'active' WHERE id = ? AND current_value < target_value AND status = 'completed'",
                params![gid],
            )?;
        }

        tx.execute("DELETE FROM activities WHERE id = ?", params![activity_id])?;
        tx.commit()?;
        Ok(Some(affected_rooms))
    } else {
        Ok(None)
    }
}

pub fn get_recent_activities(
    conn: &Connection,
    room_slug: &str,
    limit: i64,
) -> Result<Vec<Activity>> {
    let mut stmt = conn.prepare(
        r#"SELECT id, room_slug, user_token, user_nickname, user_avatar_color, COALESCE(user_avatar_emoji, ''), goal_id, activity_type, exercise_name, sets, reps, weight_per_rep, distance_val, elevation_val, total_metric, notes, created_at, parent_activity_id, COALESCE(is_pr, 0)
           FROM activities WHERE room_slug = ? ORDER BY id DESC LIMIT ?"#,
    )?;

    let rows = stmt.query_map(params![room_slug, limit], map_activity)?;

    Ok(rows.filter_map(Result::ok).collect())
}

pub fn get_leaderboard(conn: &Connection, room_slug: &str) -> Result<Vec<LeaderboardMember>> {
    let mut stmt = conn.prepare(
        r#"SELECT 
            a.user_token,
            COALESCE(NULLIF(a.user_nickname, ''), u.nickname, 'Lifter') as nick,
            COALESCE(NULLIF(a.user_avatar_color, ''), u.avatar_color, '#10b981') as col,
            COALESCE(NULLIF(a.user_avatar_emoji, ''), u.avatar_emoji, '') as emoji,
            SUM(CASE WHEN a.activity_type = 'weight' THEN a.total_metric ELSE 0 END) as total_wt,
            SUM(CASE WHEN a.activity_type = 'distance' THEN a.total_metric ELSE 0 END) as total_dist,
            SUM(CASE WHEN a.activity_type = 'elevation' THEN a.total_metric ELSE 0 END) as total_elev,
            SUM(a.sets) as total_sets
           FROM activities a
           LEFT JOIN users u ON a.user_token = u.user_token
           WHERE a.room_slug = ?
           GROUP BY COALESCE(NULLIF(a.user_nickname, ''), a.user_token)
           ORDER BY total_wt DESC, total_dist DESC, total_elev DESC"#,
    )?;

    let members_raw = stmt
        .query_map(params![room_slug], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, f64>(5)?,
                row.get::<_, f64>(6)?,
                row.get::<_, i32>(7)?,
            ))
        })?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    let grand_total_weight: f64 = members_raw.iter().map(|m| m.4).sum();
    let grand_total_distance: f64 = members_raw.iter().map(|m| m.5).sum();
    let grand_total_elevation: f64 = members_raw.iter().map(|m| m.6).sum();
    let mut leaderboard = Vec::new();

    for (idx, (token, nick, color, emoji, wt, dist, elev, sets)) in
        members_raw.into_iter().enumerate()
    {
        let wt_pct = if grand_total_weight > 0.0 {
            (wt / grand_total_weight) * 100.0
        } else {
            0.0
        };
        let dist_pct = if grand_total_distance > 0.0 {
            (dist / grand_total_distance) * 100.0
        } else {
            0.0
        };
        let elev_pct = if grand_total_elevation > 0.0 {
            (elev / grand_total_elevation) * 100.0
        } else {
            0.0
        };

        leaderboard.push(LeaderboardMember {
            user_token: token,
            nickname: nick,
            avatar_color: color,
            avatar_emoji: emoji,
            total_weight: wt,
            total_distance: dist,
            total_elevation: elev,
            total_sets: sets,
            weight_percentage: (wt_pct * 10.0).round() / 10.0,
            distance_percentage: (dist_pct * 10.0).round() / 10.0,
            elevation_percentage: (elev_pct * 10.0).round() / 10.0,
            is_daily_mvp: idx == 0 && (wt > 0.0 || dist > 0.0 || elev > 0.0),
        });
    }

    Ok(leaderboard)
}

pub fn create_custom_goal(
    conn: &Connection,
    room_slug: &str,
    req: &CreateGoalRequest,
) -> Result<Goal> {
    let now = Utc::now().to_rfc3339();
    let theme_key = req.theme_key.as_deref().unwrap_or("custom");
    let description = req.description.as_deref().unwrap_or("");

    conn.execute(
        r#"INSERT INTO goals (room_slug, title, category, target_value, current_value, unit, theme_key, status, description, created_at)
           VALUES (?, ?, ?, ?, 0.0, ?, ?, 'active', ?, ?)"#,
        params![
            room_slug,
            req.title.trim(),
            req.category.trim().to_lowercase(),
            req.target_value.max(1.0),
            req.unit.trim(),
            theme_key,
            description,
            now
        ],
    )?;

    let id = conn.last_insert_rowid();

    Ok(Goal {
        id,
        room_slug: room_slug.to_string(),
        title: req.title.trim().to_string(),
        category: req.category.trim().to_lowercase(),
        target_value: req.target_value.max(1.0),
        current_value: 0.0,
        unit: req.unit.trim().to_string(),
        theme_key: theme_key.to_string(),
        status: "active".to_string(),
        description: description.to_string(),
        created_at: now,
    })
}

pub fn create_goal_wishlist(
    conn: &Connection,
    user_token: &str,
    req: &CreateGoalWishlistRequest,
) -> Result<GoalWishlistItem> {
    let now = Utc::now().to_rfc3339();
    let notes = req.notes.as_deref().unwrap_or("").trim();
    let user_nickname = req
        .user_nickname
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| {
            conn.query_row(
                "SELECT nickname FROM users WHERE user_token = ?",
                params![user_token],
                |row| row.get::<_, String>(0),
            )
            .unwrap_or_else(|_| {
                get_or_create_user(conn, user_token, &req.room_slug)
                    .map(|u| u.nickname)
                    .unwrap_or_default()
            })
        });

    conn.execute(
        r#"INSERT INTO goal_wishlists (user_token, user_nickname, room_slug, title, category, target_value, unit, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        params![
            user_token,
            user_nickname,
            req.room_slug,
            req.title.trim(),
            req.category.trim(),
            req.target_value,
            req.unit.trim(),
            notes,
            now
        ],
    )?;

    let id = conn.last_insert_rowid();

    Ok(GoalWishlistItem {
        id,
        user_token: user_token.to_string(),
        user_nickname,
        room_slug: req.room_slug.clone(),
        title: req.title.trim().to_string(),
        category: req.category.trim().to_string(),
        target_value: req.target_value,
        unit: req.unit.trim().to_string(),
        notes: notes.to_string(),
        created_at: now,
    })
}

pub fn get_wishlists(conn: &Connection, room_slug: &str) -> Result<Vec<GoalWishlistItem>> {
    let mut stmt = conn.prepare(
        r#"SELECT gw.id, gw.user_token, COALESCE(NULLIF(gw.user_nickname, ''), u.nickname, '') AS user_nickname, gw.room_slug, gw.title, gw.category, gw.target_value, gw.unit, gw.notes, gw.created_at
           FROM goal_wishlists gw
           LEFT JOIN users u ON gw.user_token = u.user_token
           WHERE gw.room_slug = ?
           ORDER BY gw.id DESC"#,
    )?;

    let rows = stmt.query_map(params![room_slug], map_wishlist_item)?;

    Ok(rows.filter_map(Result::ok).collect())
}
