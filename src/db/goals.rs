use crate::db::*;
use crate::models::*;
use crate::store::mappers::*;
use chrono::Utc;
use rusqlite::{params, Connection, Result};

pub fn recalculate_room_goals(conn: &Connection, room_slug: &str) -> Result<()> {
    conn.execute(
        r#"UPDATE goals
           SET current_value = (
               SELECT COALESCE(SUM(a.total_metric), 0.0)
               FROM activities a
               WHERE (a.goal_id = goals.id OR (a.goal_id IS NULL AND a.room_slug = goals.room_slug AND a.activity_type = goals.category))
           )
           WHERE room_slug = ?"#,
        params![room_slug],
    )?;
    conn.execute(
        "UPDATE goals SET status = 'active' WHERE room_slug = ? AND current_value < target_value AND status = 'completed'",
        params![room_slug],
    )?;
    conn.execute(
        "UPDATE goals SET status = 'completed' WHERE room_slug = ? AND current_value >= target_value AND target_value > 0.0 AND status = 'active'",
        params![room_slug],
    )?;
    Ok(())
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

pub fn checkoff_goal(
    conn: &mut Connection,
    user: &UserProfile,
    goal_id: i64,
    notes: Option<&str>,
    is_private: Option<bool>,
) -> Result<(Goal, Activity)> {
    let goal: Goal = {
        let mut stmt = conn.prepare(
            "SELECT id, room_slug, title, category, target_value, current_value, unit, theme_key, status, description, created_at FROM goals WHERE id = ?",
        )?;
        stmt.query_row(params![goal_id], map_goal)?
    };

    if goal.status == "completed" {
        return Err(rusqlite::Error::InvalidParameterName(
            "Goal is already completed".to_string(),
        ));
    }

    let note_str = notes
        .map(|n| n.trim().to_string())
        .unwrap_or_else(|| "Accomplished!".to_string());
    let target_val = if goal.target_value > 0.0 {
        goal.target_value
    } else {
        1.0
    };
    let act_type = if goal.category.trim().is_empty() {
        "ability".to_string()
    } else {
        goal.category.trim().to_lowercase()
    };

    let req = LogActivityRequest {
        room_slug: Some(goal.room_slug.clone()),
        user_nickname: Some(user.nickname.clone()),
        user_avatar_color: Some(user.avatar_color.clone()),
        user_avatar_emoji: Some(user.avatar_emoji.clone()),
        activity_type: act_type,
        exercise_name: Some(goal.title.clone()),
        sets: Some(1),
        reps: Some(1),
        weight_per_rep: Some(0.0),
        distance_val: Some(0.0),
        elevation_val: Some(0.0),
        total_metric: Some(target_val),
        notes: Some(note_str),
        goal_id: Some(goal.id),
        created_at: None,
        parent_activity_id: None,
        is_pr: None,
        is_combined: None,
        is_private,
    };

    let activity = log_single_activity(conn, user, &goal.room_slug, &req)?;

    let updated_goal: Goal = {
        let mut stmt = conn.prepare(
            "SELECT id, room_slug, title, category, target_value, current_value, unit, theme_key, status, description, created_at FROM goals WHERE id = ?",
        )?;
        stmt.query_row(params![goal_id], map_goal)?
    };

    Ok((updated_goal, activity))
}
