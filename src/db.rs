use crate::models::*;
use chrono::Utc;
use rusqlite::{params, Connection, Result};

pub fn init_db(conn: &mut Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
            user_token TEXT PRIMARY KEY,
            nickname TEXT NOT NULL,
            avatar_color TEXT NOT NULL,
            current_room_slug TEXT NOT NULL,
            updated_at TEXT NOT NULL
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
            created_at TEXT NOT NULL
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
    "#,
    )?;

    // Ensure user_nickname column exists in goal_wishlists for existing tables
    let _ = conn.execute(
        "ALTER TABLE goal_wishlists ADD COLUMN user_nickname TEXT NOT NULL DEFAULT ''",
        [],
    );

    // Ensure default main room exists with a concise, clean squad name
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR IGNORE INTO rooms (slug, name, created_at) VALUES ('main', 'Pando Squad', ?)",
        params![now],
    )?;
    conn.execute(
        "UPDATE rooms SET name = 'Pando Squad' WHERE slug = 'main' AND name = 'Pando & Friends Gym Crew'",
        [],
    )?;

    // Check if default goals need to be seeded for 'main'
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM goals WHERE room_slug = 'main'",
        [],
        |row| row.get(0),
    )?;

    if count == 0 {
        // 1. Pando (Active Weight Goal) - starts clean at 0.0
        conn.execute(
            r#"INSERT INTO goals (room_slug, title, category, target_value, current_value, unit, theme_key, status, description, created_at)
               VALUES ('main', 'Pando Aspen Clone', 'weight', 13200000.0, 0.0, 'lbs', 'pando', 'active', 'Hoisting the 13.2-million-pound underground root system of Utah’s massive clonal aspen grove.', ?)"#,
            params![now],
        )?;

        // 2. Caribou Migration (Active Distance Goal) - starts clean at 0.0
        conn.execute(
            r#"INSERT INTO goals (room_slug, title, category, target_value, current_value, unit, theme_key, status, description, created_at)
               VALUES ('main', 'Caribou Migration', 'distance', 3000.0, 0.0, 'mi', 'caribou', 'active', 'Running, walking, and biking the majestic 3,000-mile Arctic tundra migration.', ?)"#,
            params![now],
        )?;

        // 3. Mt. Everest Climb (Active Elevation Goal) - starts clean at 0.0
        conn.execute(
            r#"INSERT INTO goals (room_slug, title, category, target_value, current_value, unit, theme_key, status, description, created_at)
               VALUES ('main', 'Mt. Everest Ascent', 'elevation', 29031.0, 0.0, 'ft', 'everest', 'active', 'Scaling the roof of the world with nimble mountain goats.', ?)"#,
            params![now],
        )?;

        // 4. The Blue Whale (Completed Trophy Goal)
        conn.execute(
            r#"INSERT INTO goals (room_slug, title, category, target_value, current_value, unit, theme_key, status, description, created_at)
               VALUES ('main', 'The Blue Whale', 'weight', 418878.0, 418878.0, 'lbs', 'whale', 'completed', '🏆 CONQUERED! The crew hoisted the full weight of a colossal Blue Whale.', ?)"#,
            params![now],
        )?;
    }

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

pub fn get_or_create_room(conn: &Connection, slug: &str) -> Result<Room> {
    let mut stmt = conn.prepare("SELECT id, slug, name, created_at FROM rooms WHERE slug = ?")?;
    let found = stmt.query_row(params![slug], |row| {
        Ok(Room {
            id: row.get(0)?,
            slug: row.get(1)?,
            name: row.get(2)?,
            created_at: row.get(3)?,
        })
    });

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
                "INSERT INTO rooms (slug, name, created_at) VALUES (?, ?, ?)",
                params![slug, pretty_name, now],
            )?;
            let id = conn.last_insert_rowid();

            // Seed initial goals for newly created rooms
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

            Ok(Room {
                id,
                slug: slug.to_string(),
                name: pretty_name,
                created_at: now,
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

pub fn get_or_create_user(
    conn: &Connection,
    token: &str,
    default_room: &str,
) -> Result<UserProfile> {
    let mut stmt = conn.prepare(
        "SELECT user_token, nickname, avatar_color, current_room_slug, updated_at FROM users WHERE user_token = ?",
    )?;
    let found = stmt.query_row(params![token], |row| {
        Ok(UserProfile {
            user_token: row.get(0)?,
            nickname: row.get(1)?,
            avatar_color: row.get(2)?,
            current_room_slug: row.get(3)?,
            updated_at: row.get(4)?,
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
                "#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4",
            ];

            // Derive consistent index from token hash
            let hash: usize = token.bytes().map(|b| b as usize).sum();
            let nickname = format!(
                "{}_{}",
                default_names[hash % default_names.len()],
                &token[..4.min(token.len())]
            );
            let avatar_color = default_colors[hash % default_colors.len()].to_string();
            let now = Utc::now().to_rfc3339();

            conn.execute(
                "INSERT INTO users (user_token, nickname, avatar_color, current_room_slug, updated_at) VALUES (?, ?, ?, ?, ?)",
                params![token, nickname, avatar_color, default_room, now],
            )?;

            Ok(UserProfile {
                user_token: token.to_string(),
                nickname,
                avatar_color,
                current_room_slug: default_room.to_string(),
                updated_at: now,
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
    let room = req
        .current_room_slug
        .as_deref()
        .unwrap_or(&current.current_room_slug);
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE users SET nickname = ?, avatar_color = ?, current_room_slug = ?, updated_at = ? WHERE user_token = ?",
        params![nickname, color, room, now, token],
    )?;

    Ok(UserProfile {
        user_token: token.to_string(),
        nickname: nickname.to_string(),
        avatar_color: color.to_string(),
        current_room_slug: room.to_string(),
        updated_at: now,
    })
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

    let rows = stmt.query_map(params![room_slug], |row| {
        Ok(Goal {
            id: row.get(0)?,
            room_slug: row.get(1)?,
            title: row.get(2)?,
            category: row.get(3)?,
            target_value: row.get(4)?,
            current_value: row.get(5)?,
            unit: row.get(6)?,
            theme_key: row.get(7)?,
            status: row.get(8)?,
            description: row.get(9)?,
            created_at: row.get(10)?,
        })
    })?;

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
    let notes = req.notes.as_deref().unwrap_or("").trim();

    tx.execute(
        r#"INSERT INTO activities 
           (room_slug, user_token, user_nickname, user_avatar_color, goal_id, activity_type, exercise_name, sets, reps, weight_per_rep, distance_val, elevation_val, total_metric, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        params![
            room_slug,
            user.user_token,
            nickname,
            avatar_color,
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
            activity_time
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
    })
}

pub fn delete_activity(
    conn: &mut Connection,
    activity_id: i64,
    user_token: &str,
) -> Result<Option<String>> {
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
        Ok(Some(room_slug))
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
        r#"SELECT id, room_slug, user_token, user_nickname, user_avatar_color, goal_id, activity_type, exercise_name, sets, reps, weight_per_rep, distance_val, elevation_val, total_metric, notes, created_at
           FROM activities WHERE room_slug = ? ORDER BY id DESC LIMIT ?"#,
    )?;

    let rows = stmt.query_map(params![room_slug, limit], |row| {
        Ok(Activity {
            id: row.get(0)?,
            room_slug: row.get(1)?,
            user_token: row.get(2)?,
            user_nickname: row.get(3)?,
            user_avatar_color: row.get(4)?,
            goal_id: row.get(5)?,
            activity_type: row.get(6)?,
            exercise_name: row.get(7)?,
            sets: row.get(8)?,
            reps: row.get(9)?,
            weight_per_rep: row.get(10)?,
            distance_val: row.get(11)?,
            elevation_val: row.get(12)?,
            total_metric: row.get(13)?,
            notes: row.get(14)?,
            created_at: row.get(15)?,
        })
    })?;

    Ok(rows.filter_map(Result::ok).collect())
}

pub fn get_leaderboard(conn: &Connection, room_slug: &str) -> Result<Vec<LeaderboardMember>> {
    let mut stmt = conn.prepare(
        r#"SELECT 
            a.user_token,
            COALESCE(NULLIF(a.user_nickname, ''), u.nickname, 'Lifter') as nick,
            COALESCE(NULLIF(a.user_avatar_color, ''), u.avatar_color, '#10b981') as col,
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
                row.get::<_, f64>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, f64>(5)?,
                row.get::<_, i32>(6)?,
            ))
        })?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    let grand_total_weight: f64 = members_raw.iter().map(|m| m.3).sum();
    let grand_total_distance: f64 = members_raw.iter().map(|m| m.4).sum();
    let grand_total_elevation: f64 = members_raw.iter().map(|m| m.5).sum();
    let mut leaderboard = Vec::new();

    for (idx, (token, nick, color, wt, dist, elev, sets)) in members_raw.into_iter().enumerate() {
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

    let rows = stmt.query_map(params![room_slug], |r| {
        Ok(GoalWishlistItem {
            id: r.get(0)?,
            user_token: r.get(1)?,
            user_nickname: r.get(2)?,
            room_slug: r.get(3)?,
            title: r.get(4)?,
            category: r.get(5)?,
            target_value: r.get(6)?,
            unit: r.get(7)?,
            notes: r.get(8)?,
            created_at: r.get(9)?,
        })
    })?;

    Ok(rows.filter_map(Result::ok).collect())
}
