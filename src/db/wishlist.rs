use crate::db::*;
use crate::models::*;
use crate::store::mappers::*;
use chrono::Utc;
use rusqlite::{params, Connection, Result};

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
