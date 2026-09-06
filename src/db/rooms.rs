use crate::db::*;
use crate::models::*;
use crate::store::mappers::*;
use chrono::Utc;
use rusqlite::{params, Connection, Result};

pub fn get_or_create_room(conn: &Connection, slug: &str) -> Result<Room> {
    let mut stmt =
        conn.prepare("SELECT id, slug, name, created_at, creator_token, COALESCE(keep_departed_contributions, 1) FROM rooms WHERE slug = ?")?;
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
                "INSERT INTO rooms (slug, name, created_at, creator_token, keep_departed_contributions) VALUES (?, ?, ?, '', 1)",
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
                keep_departed_contributions: true,
            })
        }
        Err(e) => Err(e),
    }
}

pub fn update_room_settings(
    conn: &Connection,
    slug: &str,
    creator_token: &str,
    keep_departed_contributions: bool,
) -> std::result::Result<Room, String> {
    let current_creator: String = conn
        .query_row(
            "SELECT COALESCE(creator_token, '') FROM rooms WHERE slug = ?",
            params![slug],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    if current_creator != creator_token {
        return Err("Only the squad creator can update squad settings".to_string());
    }

    let val = if keep_departed_contributions { 1 } else { 0 };
    conn.execute(
        "UPDATE rooms SET keep_departed_contributions = ? WHERE slug = ?",
        params![val, slug],
    )
    .map_err(|e| e.to_string())?;

    get_or_create_room(conn, slug).map_err(|e| e.to_string())
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

    if !room_slug.starts_with("solo-") {
        let _ = sync_user_activities_to_room(conn, tok, room_slug);
    }

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
    let keep_contribs: i32 = conn
        .query_row(
            "SELECT COALESCE(keep_departed_contributions, 1) FROM rooms WHERE slug = ?",
            params![room_slug],
            |r| r.get(0),
        )
        .unwrap_or(1);

    let _ = conn.execute(
        "DELETE FROM room_members WHERE room_slug = ? AND user_token = ?",
        params![room_slug, user_token],
    );

    if keep_contribs == 0 {
        let _ = conn.execute(
            "DELETE FROM activities WHERE room_slug = ? AND user_token = ?",
            params![room_slug, user_token],
        );
        let _ = recalculate_room_goals(conn, room_slug);
    }

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
    keep_contributions: bool,
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

    if !keep_contributions {
        let _ = conn.execute(
            "DELETE FROM activities WHERE room_slug = ? AND user_token = ?",
            params![room_slug, target_token],
        );
        let _ = recalculate_room_goals(conn, room_slug);
    }

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
        "INSERT INTO rooms (slug, name, created_at, creator_token, keep_departed_contributions) VALUES (?, ?, ?, ?, 1)",
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

        let _ = sync_user_activities_to_room(conn, tok, &slug);
    }

    Ok(Room {
        id,
        slug,
        name: chosen_name.to_string(),
        created_at: now,
        creator_token: tok.to_string(),
        keep_departed_contributions: true,
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
