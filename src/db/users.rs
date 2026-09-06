use crate::db::*;
use crate::models::*;
use chrono::{Duration, NaiveDate, Utc};
use rusqlite::{params, Connection, Result};

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

pub fn get_user_personal_stats(conn: &Connection, user_token: &str) -> Result<UserPersonalStats> {
    let mut stmt = conn.prepare(
        r#"SELECT 
            COALESCE(SUM(CASE 
                WHEN a.activity_type = 'weight' THEN a.total_metric
                WHEN a.weight_per_rep > 0.0 AND a.distance_val = 0.0 AND a.elevation_val = 0.0 THEN a.total_metric
                ELSE 0.0 
            END), 0.0) as total_wt,
            COALESCE(SUM(CASE 
                WHEN a.activity_type = 'distance' THEN a.total_metric
                WHEN a.distance_val > 0.0 THEN a.distance_val
                ELSE 0.0 
            END), 0.0) as total_dist,
            COALESCE(SUM(CASE 
                WHEN a.activity_type = 'elevation' THEN a.total_metric
                WHEN a.elevation_val > 0.0 THEN a.elevation_val
                ELSE 0.0 
            END), 0.0) as total_elev,
            COALESCE(SUM(a.sets), 0) as total_sets,
            COALESCE(SUM(CASE WHEN a.activity_type = 'ability' THEN 1 ELSE 0 END), 0) as total_feats
           FROM activities a
           WHERE a.user_token = ? AND (a.parent_activity_id IS NULL OR a.parent_activity_id = 0)"#,
    )?;

    let stats = stmt.query_row(params![user_token], |row| {
        Ok(UserPersonalStats {
            total_weight: row.get(0)?,
            total_distance: row.get(1)?,
            total_elevation: row.get(2)?,
            total_sets: row.get(3)?,
            total_feats: row.get(4)?,
        })
    })?;

    Ok(stats)
}

pub fn get_or_create_user(
    conn: &Connection,
    token: &str,
    default_room: &str,
) -> Result<UserProfile> {
    let (streak_days, tardigrade_state) = calculate_user_streak(conn, token);
    let personal_stats = get_user_personal_stats(conn, token).unwrap_or_default();
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
            personal_stats: personal_stats.clone(),
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
                personal_stats,
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
    let personal_stats = get_user_personal_stats(conn, token).unwrap_or_default();

    Ok(UserProfile {
        user_token: token.to_string(),
        nickname: nickname.to_string(),
        avatar_color: color.to_string(),
        avatar_emoji: emoji,
        current_room_slug: room.to_string(),
        updated_at: now,
        streak_days,
        tardigrade_state,
        personal_stats,
    })
}
