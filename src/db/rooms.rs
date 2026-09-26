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

pub fn is_room_admin(conn: &Connection, room_slug: &str, user_token: &str) -> Result<bool> {
    let tok = user_token.trim();
    if tok.is_empty() {
        return Ok(false);
    }
    if room_slug.starts_with("solo-") {
        return Ok(true);
    }
    let creator: String = conn
        .query_row(
            "SELECT COALESCE(creator_token, '') FROM rooms WHERE slug = ?",
            params![room_slug],
            |r| r.get(0),
        )
        .unwrap_or_default();
    if !creator.is_empty() && creator == tok {
        return Ok(true);
    }
    let role: rusqlite::Result<String> = conn.query_row(
        "SELECT role FROM room_members WHERE room_slug = ? AND user_token = ?",
        params![room_slug, tok],
        |r| r.get(0),
    );
    match role {
        Ok(r) => Ok(r == "creator" || r == "admin"),
        Err(_) => Ok(false),
    }
}

pub fn is_room_creator(conn: &Connection, room_slug: &str, user_token: &str) -> Result<bool> {
    let tok = user_token.trim();
    if tok.is_empty() {
        return Ok(false);
    }
    if room_slug.starts_with("solo-") {
        return Ok(true);
    }
    let creator: String = conn
        .query_row(
            "SELECT COALESCE(creator_token, '') FROM rooms WHERE slug = ?",
            params![room_slug],
            |r| r.get(0),
        )
        .unwrap_or_default();
    if !creator.is_empty() && creator == tok {
        return Ok(true);
    }
    let role: rusqlite::Result<String> = conn.query_row(
        "SELECT role FROM room_members WHERE room_slug = ? AND user_token = ?",
        params![room_slug, tok],
        |r| r.get(0),
    );
    match role {
        Ok(r) => Ok(r == "creator"),
        Err(_) => Ok(false),
    }
}

pub fn ensure_admin_succession(conn: &Connection, room_slug: &str) -> Result<()> {
    if room_slug.starts_with("solo-") {
        return Ok(());
    }

    let creator_token: String = conn
        .query_row(
            "SELECT COALESCE(creator_token, '') FROM rooms WHERE slug = ?",
            params![room_slug],
            |r| r.get(0),
        )
        .unwrap_or_default();

    let creator_in_members: bool = if !creator_token.is_empty() {
        conn.query_row(
            "SELECT COUNT(*) FROM room_members WHERE room_slug = ? AND user_token = ?",
            params![room_slug, creator_token],
            |r| r.get::<_, i64>(0),
        )
        .unwrap_or(0)
            > 0
    } else {
        false
    };

    let admin_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM room_members WHERE room_slug = ? AND (role = 'creator' OR role = 'admin')",
            params![room_slug],
            |r| r.get(0),
        )
        .unwrap_or(0);

    // If there is no creator currently in the squad, or no member has admin/creator role
    if admin_count == 0 || !creator_in_members {
        // Prioritize existing admins (by seniority), then most senior regular member
        let next_owner: rusqlite::Result<(String, String)> = conn.query_row(
            "SELECT user_token, role FROM room_members WHERE room_slug = ? ORDER BY (role IN ('creator', 'admin')) DESC, joined_at ASC LIMIT 1",
            params![room_slug],
            |r| Ok((r.get(0)?, r.get(1)?)),
        );

        if let Ok((new_owner, current_role)) = next_owner {
            if current_role != "creator" && current_role != "admin" {
                conn.execute(
                    "UPDATE room_members SET role = 'admin' WHERE room_slug = ? AND user_token = ?",
                    params![room_slug, new_owner],
                )?;
            }
            if !creator_in_members || creator_token.is_empty() {
                conn.execute(
                    "UPDATE rooms SET creator_token = ? WHERE slug = ?",
                    params![new_owner, room_slug],
                )?;
            }
        } else if !creator_in_members {
            conn.execute(
                "UPDATE rooms SET creator_token = '' WHERE slug = ?",
                params![room_slug],
            )?;
        }
    }

    Ok(())
}

pub fn update_room_settings(
    conn: &Connection,
    slug: &str,
    caller_token: &str,
    keep_departed_contributions: bool,
) -> std::result::Result<Room, String> {
    let is_admin = is_room_admin(conn, slug, caller_token).map_err(|e| e.to_string())?;
    if !is_admin {
        return Err("Only squad admins can update squad settings".to_string());
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
         ON CONFLICT(room_slug, user_token) DO UPDATE SET role = CASE WHEN room_members.role IN ('creator', 'admin') THEN room_members.role ELSE excluded.role END",
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

    // Self-heal and ensure admin succession if the creator left or no admin remains
    let _ = ensure_admin_succession(conn, room_slug);

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
        ORDER BY (rm.user_token = ? OR rm.role = 'creator') DESC, (rm.role = 'admin') DESC, rm.joined_at ASC
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
        let is_admin = is_creator || db_role == "admin";
        let role = if db_role == "admin" {
            "admin".to_string()
        } else if is_creator {
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
            is_admin,
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

    // Ensure succession if the room creator or an admin left
    let _ = ensure_admin_succession(conn, room_slug);

    Ok(solo_slug)
}

pub fn remove_room_member(
    conn: &Connection,
    room_slug: &str,
    caller_token: &str,
    target_token: &str,
    keep_contributions: bool,
) -> std::result::Result<String, String> {
    let is_admin = is_room_admin(conn, room_slug, caller_token).map_err(|e| e.to_string())?;
    if !is_admin {
        return Err("Only squad admins can remove members from this squad".to_string());
    }

    if caller_token == target_token {
        return Err("Squad creator cannot remove themselves; use leave squad instead".to_string());
    }

    let target_role: String = conn
        .query_row(
            "SELECT role FROM room_members WHERE room_slug = ? AND user_token = ?",
            params![room_slug, target_token],
            |r| r.get(0),
        )
        .map_err(|_| "Target member not found in this squad".to_string())?;

    let is_caller_creator = is_room_creator(conn, room_slug, caller_token).unwrap_or(false);
    if (target_role == "admin" || target_role == "creator") && !is_caller_creator {
        return Err("Only the squad creator can remove an admin from this squad".to_string());
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

    let _ = ensure_admin_succession(conn, room_slug);

    Ok(solo_slug)
}

pub fn update_member_role(
    conn: &Connection,
    room_slug: &str,
    caller_token: &str,
    target_token: &str,
    new_role: &str,
) -> std::result::Result<(), String> {
    let caller = caller_token.trim();
    let target = target_token.trim();
    let role = new_role.trim().to_lowercase();

    if role != "admin" && role != "member" {
        return Err("Invalid role. Role must be 'admin' or 'member'".to_string());
    }

    if room_slug.starts_with("solo-") {
        return Err("Cannot change roles in a solo quest".to_string());
    }

    let is_caller_admin = is_room_admin(conn, room_slug, caller).map_err(|e| e.to_string())?;
    if !is_caller_admin {
        return Err("Only squad admins can manage member roles".to_string());
    }

    let target_current_role: String = conn
        .query_row(
            "SELECT role FROM room_members WHERE room_slug = ? AND user_token = ?",
            params![room_slug, target],
            |r| r.get(0),
        )
        .map_err(|_| "Target user is not a member of this squad".to_string())?;

    let is_caller_creator = is_room_creator(conn, room_slug, caller).unwrap_or(false);

    // If demoting an admin to regular member: only creator can demote other admins
    if role == "member" && (target_current_role == "admin" || target_current_role == "creator") {
        if !is_caller_creator {
            return Err("Only the squad creator can demote other admins".to_string());
        }
        if caller == target {
            return Err(
                "Squad creator cannot demote themselves; transfer ownership or leave squad instead"
                    .to_string(),
            );
        }
    }

    conn.execute(
        "UPDATE room_members SET role = ? WHERE room_slug = ? AND user_token = ?",
        params![role, room_slug, target],
    )
    .map_err(|e| e.to_string())?;

    let _ = ensure_admin_succession(conn, room_slug);

    Ok(())
}

pub fn delete_room(
    conn: &mut Connection,
    room_slug: &str,
    admin_token: &str,
) -> std::result::Result<String, String> {
    let tok = admin_token.trim();
    if room_slug.starts_with("solo-") {
        return Err("Solo rooms cannot be deleted".to_string());
    }

    let is_admin = is_room_admin(conn, room_slug, tok).map_err(|e| e.to_string())?;
    if !is_admin {
        return Err("Only squad admins can delete this squad".to_string());
    }

    let solo_slug = generate_solo_room_slug(tok);

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Move any members currently viewing/assigned to this room to their solo room
    {
        let mut stmt = tx
            .prepare("SELECT user_token FROM room_members WHERE room_slug = ?")
            .map_err(|e| e.to_string())?;
        let member_tokens: Vec<String> = stmt
            .query_map(params![room_slug], |r| r.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        for m_tok in &member_tokens {
            let m_solo = generate_solo_room_slug(m_tok);
            tx.execute(
                "UPDATE users SET current_room_slug = ? WHERE user_token = ? AND current_room_slug = ?",
                params![m_solo, m_tok, room_slug],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    tx.execute(
        "DELETE FROM activities WHERE room_slug = ?",
        params![room_slug],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM goals WHERE room_slug = ?", params![room_slug])
        .map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM goal_wishlists WHERE room_slug = ?",
        params![room_slug],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM room_members WHERE room_slug = ?",
        params![room_slug],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM rooms WHERE slug = ?", params![room_slug])
        .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

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
            rm.joined_at,
            (r.creator_token = ? OR rm.role = 'creator' OR rm.role = 'admin') AS is_admin
        FROM room_members rm
        JOIN rooms r ON r.slug = rm.room_slug
        WHERE rm.user_token = ? AND r.slug NOT LIKE 'solo-%'
        ORDER BY rm.joined_at DESC
    "#,
    )?;

    let rows = stmt.query_map(params![tok, tok, tok], map_user_squad_summary)?;

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
