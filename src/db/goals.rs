use crate::db::*;
use crate::models::*;
use crate::store::mappers::*;
use chrono::Utc;
use rusqlite::{params, Connection, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IronmanLeg {
    Swim,
    Bike,
    Run,
}

pub fn classify_ironman_leg(activity_type: &str, exercise_name: &str, notes: &str) -> IronmanLeg {
    let act = activity_type.trim().to_lowercase();
    let ex = exercise_name.trim().to_lowercase();
    let nt = notes.trim().to_lowercase();

    if act == "swim"
        || ex.contains("swim")
        || ex.contains("lap")
        || ex.contains("pool")
        || ex.contains("stroke")
        || ex.contains("water")
        || nt.contains("swim")
    {
        IronmanLeg::Swim
    } else if act == "bike"
        || ex.contains("bike")
        || ex.contains("cycl")
        || ex.contains("spin")
        || ex.contains("pedal")
        || ex.contains("ride")
        || nt.contains("bike")
    {
        IronmanLeg::Bike
    } else {
        IronmanLeg::Run
    }
}

pub fn compute_composite_progress_for_goal(
    conn: &Connection,
    goal_id: i64,
    room_slug: &str,
) -> Result<(CompositeProgress, bool)> {
    // Lazy Tri composite goal is strictly for October 2026 (2026-10-01 to 2026-10-31)
    let mut stmt = conn.prepare(
        r#"SELECT activity_type, exercise_name, notes, distance_val, total_metric
           FROM activities
           WHERE room_slug = ?
             AND (goal_id = ? OR activity_type = 'distance' OR distance_val > 0.0)
             AND created_at >= '2026-10-01'
             AND created_at < '2026-11-01'"#,
    )?;

    let mut swim_current = 0.0;
    let mut bike_current = 0.0;
    let mut run_current = 0.0;

    let rows = stmt.query_map(params![room_slug, goal_id], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, f64>(3)?,
            r.get::<_, f64>(4)?,
        ))
    })?;

    for row in rows.flatten() {
        let (act_type, ex_name, notes, dist_val, total_metric) = row;
        let metric = if dist_val > 0.0 {
            dist_val
        } else {
            total_metric
        };
        if metric <= 0.0 {
            continue;
        }

        match classify_ironman_leg(&act_type, &ex_name, &notes) {
            IronmanLeg::Swim => swim_current += metric,
            IronmanLeg::Bike => bike_current += metric,
            IronmanLeg::Run => run_current += metric,
        }
    }

    let swim_target = 2.4;
    let bike_target = 112.0;
    let run_target = 26.2;

    let effective_swim = swim_current.min(swim_target);
    let effective_bike = bike_current.min(bike_target);
    let effective_run = run_current.min(run_target);

    let is_completed = effective_swim >= swim_target
        && effective_bike >= bike_target
        && effective_run >= run_target;

    Ok((
        CompositeProgress {
            swim_current: (swim_current * 100.0).round() / 100.0,
            swim_target,
            bike_current: (bike_current * 100.0).round() / 100.0,
            bike_target,
            run_current: (run_current * 100.0).round() / 100.0,
            run_target,
        },
        is_completed,
    ))
}

pub fn recalculate_room_goals(conn: &Connection, room_slug: &str) -> Result<()> {
    // 1. Recalculate distance goals (e.g. Caribou Migration)
    conn.execute(
        r#"UPDATE goals
           SET current_value = (
               SELECT COALESCE(SUM(CASE WHEN a.distance_val > 0.0 THEN a.distance_val ELSE a.total_metric END), 0.0)
               FROM activities a
               WHERE a.room_slug = goals.room_slug AND (a.activity_type = 'distance' OR a.distance_val > 0.0 OR a.goal_id = goals.id)
           )
           WHERE room_slug = ? AND category = 'distance' AND theme_key != 'whale'"#,
        params![room_slug],
    )?;

    // 2. Recalculate elevation goals (e.g. Mt. Everest Ascent)
    conn.execute(
        r#"UPDATE goals
           SET current_value = (
               SELECT COALESCE(SUM(CASE WHEN a.elevation_val > 0.0 THEN a.elevation_val ELSE a.total_metric END), 0.0)
               FROM activities a
               WHERE a.room_slug = goals.room_slug AND (a.activity_type = 'elevation' OR a.elevation_val > 0.0 OR a.goal_id = goals.id)
           )
           WHERE room_slug = ? AND category = 'elevation' AND theme_key != 'whale'"#,
        params![room_slug],
    )?;

    // 3. Recalculate other non-composite goals (e.g. Pando, weight, ability feats)
    conn.execute(
        r#"UPDATE goals
           SET current_value = (
               SELECT COALESCE(SUM(a.total_metric), 0.0)
               FROM activities a
               WHERE a.room_slug = goals.room_slug AND (a.goal_id = goals.id OR a.activity_type = goals.category)
           )
           WHERE room_slug = ? AND category NOT IN ('distance', 'elevation', 'composite') AND theme_key != 'ironman' AND theme_key != 'whale'"#,
        params![room_slug],
    )?;

    // 4. Update status for non-composite goals
    conn.execute(
        "UPDATE goals SET status = 'active' WHERE room_slug = ? AND current_value < target_value AND status = 'completed' AND category != 'composite' AND theme_key != 'ironman' AND theme_key != 'whale'",
        params![room_slug],
    )?;
    conn.execute(
        "UPDATE goals SET status = 'completed' WHERE room_slug = ? AND current_value >= target_value AND target_value > 0.0 AND status = 'active' AND category != 'composite' AND theme_key != 'ironman' AND theme_key != 'whale'",
        params![room_slug],
    )?;

    // 5. Recalculate composite goals (e.g. Lazy Ironman)
    let mut comp_stmt = conn.prepare(
        "SELECT id FROM goals WHERE room_slug = ? AND (category = 'composite' OR theme_key = 'ironman')",
    )?;
    let comp_ids: Vec<i64> = comp_stmt
        .query_map(params![room_slug], |r| r.get(0))?
        .filter_map(Result::ok)
        .collect();

    for gid in comp_ids {
        let (comp_progress, is_done) = compute_composite_progress_for_goal(conn, gid, room_slug)?;
        let effective_val = comp_progress.swim_current.min(comp_progress.swim_target)
            + comp_progress.bike_current.min(comp_progress.bike_target)
            + comp_progress.run_current.min(comp_progress.run_target);
        let status = if is_done { "completed" } else { "active" };
        conn.execute(
            "UPDATE goals SET current_value = ?, status = ? WHERE id = ?",
            params![effective_val, status, gid],
        )?;
    }

    Ok(())
}

pub fn get_goals_for_room(conn: &Connection, room_slug: &str) -> Result<(Vec<Goal>, Vec<Goal>)> {
    recalculate_room_goals(conn, room_slug)?;

    let mut stmt = conn.prepare(
        "SELECT id, room_slug, title, category, target_value, current_value, unit, theme_key, status, description, created_at
         FROM goals WHERE room_slug = ? ORDER BY id ASC",
    )?;

    let mut active = Vec::new();
    let mut completed = Vec::new();

    let rows = stmt.query_map(params![room_slug], map_goal)?;

    for mut g in rows.flatten() {
        if g.category == "composite" || g.theme_key == "ironman" {
            if let Ok((comp_progress, _)) =
                compute_composite_progress_for_goal(conn, g.id, room_slug)
            {
                g.composite_progress = Some(comp_progress);
            }
        }
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

    let mut goal = Goal {
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
        composite_progress: None,
    };

    if goal.category == "composite" || goal.theme_key == "ironman" {
        if let Ok((comp_progress, _)) = compute_composite_progress_for_goal(conn, id, room_slug) {
            goal.composite_progress = Some(comp_progress);
        }
    }

    Ok(goal)
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
