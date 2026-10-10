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
    viewer_user_token: Option<&str>,
) -> Result<(CompositeProgress, bool)> {
    // 1. Gather all squad members from room_members + users
    let mut member_map: std::collections::HashMap<String, (String, String, String)> =
        std::collections::HashMap::new();
    let mut member_order: Vec<String> = Vec::new();

    let mut mem_stmt = conn.prepare(
        r#"SELECT rm.user_token, COALESCE(u.nickname, ''), COALESCE(u.avatar_color, '#7aa2f7'), COALESCE(u.avatar_emoji, '')
           FROM room_members rm
           LEFT JOIN users u ON u.user_token = rm.user_token
           WHERE rm.room_slug = ?
           ORDER BY rm.joined_at ASC"#,
    )?;
    let mem_rows = mem_stmt.query_map(params![room_slug], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, String>(3)?,
        ))
    })?;
    for m in mem_rows.flatten() {
        let (tok, nick, color, emoji) = m;
        member_map.insert(tok.clone(), (nick, color, emoji));
        if !member_order.contains(&tok) {
            member_order.push(tok);
        }
    }

    // If viewer_user_token provided and not yet in member_map, query users table
    if let Some(vtok) = viewer_user_token {
        if !vtok.is_empty() && !member_map.contains_key(vtok) {
            let u_res: rusqlite::Result<(String, String, String)> = conn.query_row(
                "SELECT nickname, avatar_color, avatar_emoji FROM users WHERE user_token = ?",
                params![vtok],
                |row| {
                    Ok((
                        row.get::<_, String>(0).unwrap_or_default(),
                        row.get::<_, String>(1)
                            .unwrap_or_else(|_| "#7aa2f7".to_string()),
                        row.get::<_, String>(2).unwrap_or_default(),
                    ))
                },
            );
            if let Ok((nick, color, emoji)) = u_res {
                member_map.insert(vtok.to_string(), (nick, color, emoji));
                member_order.push(vtok.to_string());
            }
        }
    }

    // 2. Query all activities in room for October 2026
    let mut stmt = conn.prepare(
        r#"SELECT user_token, activity_type, exercise_name, notes, distance_val, total_metric,
                  COALESCE(user_nickname, ''), COALESCE(user_avatar_color, ''), COALESCE(user_avatar_emoji, '')
           FROM activities
           WHERE room_slug = ?
             AND (goal_id = ? OR activity_type = 'distance' OR distance_val > 0.0)
             AND created_at >= '2026-10-01'
             AND created_at < '2026-11-01'"#,
    )?;

    let mut user_legs: std::collections::HashMap<String, (f64, f64, f64)> =
        std::collections::HashMap::new();

    let rows = stmt.query_map(params![room_slug, goal_id], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, String>(3)?,
            r.get::<_, f64>(4)?,
            r.get::<_, f64>(5)?,
            r.get::<_, String>(6)?,
            r.get::<_, String>(7)?,
            r.get::<_, String>(8)?,
        ))
    })?;

    for row in rows.flatten() {
        let (u_tok, act_type, ex_name, notes, dist_val, total_metric, u_nick, u_color, u_emoji) =
            row;
        if !u_tok.is_empty() && !member_map.contains_key(&u_tok) {
            let nick = if u_nick.is_empty() {
                "Athlete".to_string()
            } else {
                u_nick
            };
            let color = if u_color.is_empty() {
                "#7aa2f7".to_string()
            } else {
                u_color
            };
            member_map.insert(u_tok.clone(), (nick, color, u_emoji));
            member_order.push(u_tok.clone());
        }

        let metric = if dist_val > 0.0 {
            dist_val
        } else {
            total_metric
        };
        if metric <= 0.0 {
            continue;
        }

        let entry = user_legs.entry(u_tok).or_insert((0.0, 0.0, 0.0));
        match classify_ironman_leg(&act_type, &ex_name, &notes) {
            IronmanLeg::Swim => entry.0 += metric,
            IronmanLeg::Bike => entry.1 += metric,
            IronmanLeg::Run => entry.2 += metric,
        }
    }

    let swim_target = 2.4;
    let bike_target = 112.0;
    let run_target = 26.2;
    let total_target = 140.6;

    let mut members_progress: Vec<MemberCompositeProgress> = Vec::new();

    for tok in &member_order {
        let (nick, color, emoji) = member_map
            .get(tok)
            .cloned()
            .unwrap_or_else(|| ("Athlete".to_string(), "#7aa2f7".to_string(), String::new()));
        let (raw_swim, raw_bike, raw_run) = user_legs.get(tok).copied().unwrap_or((0.0, 0.0, 0.0));
        let swim_current = (raw_swim * 100.0).round() / 100.0;
        let bike_current = (raw_bike * 100.0).round() / 100.0;
        let run_current = (raw_run * 100.0).round() / 100.0;

        let eff_swim = raw_swim.min(swim_target);
        let eff_bike = raw_bike.min(bike_target);
        let eff_run = raw_run.min(run_target);
        let total_current = ((eff_swim + eff_bike + eff_run) * 100.0).round() / 100.0;
        let is_completed =
            eff_swim >= swim_target && eff_bike >= bike_target && eff_run >= run_target;
        let percent = (((total_current / total_target) * 100.0) * 10.0).round() / 10.0;

        members_progress.push(MemberCompositeProgress {
            user_token: tok.clone(),
            nickname: if nick.trim().is_empty() {
                "Athlete".to_string()
            } else {
                nick
            },
            avatar_color: if color.trim().is_empty() {
                "#7aa2f7".to_string()
            } else {
                color
            },
            avatar_emoji: emoji,
            swim_current,
            bike_current,
            run_current,
            total_current,
            percent,
            is_completed,
        });
    }

    // Sort teammates: completed first, then highest percent, then highest total_current
    members_progress.sort_by(|a, b| {
        b.is_completed
            .cmp(&a.is_completed)
            .then_with(|| {
                b.percent
                    .partial_cmp(&a.percent)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| {
                b.total_current
                    .partial_cmp(&a.total_current)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
    });

    // 3. Resolve viewer stats
    let (viewer_swim, viewer_bike, viewer_run, viewer_is_completed) = {
        if let Some(vtok) = viewer_user_token {
            if let Some(m) = members_progress.iter().find(|m| m.user_token == vtok) {
                (
                    m.swim_current,
                    m.bike_current,
                    m.run_current,
                    m.is_completed,
                )
            } else {
                (0.0, 0.0, 0.0, false)
            }
        } else if members_progress.len() == 1 {
            let m = &members_progress[0];
            (
                m.swim_current,
                m.bike_current,
                m.run_current,
                m.is_completed,
            )
        } else {
            (0.0, 0.0, 0.0, false)
        }
    };

    Ok((
        CompositeProgress {
            swim_current: viewer_swim,
            swim_target,
            bike_current: viewer_bike,
            bike_target,
            run_current: viewer_run,
            run_target,
            is_completed: viewer_is_completed,
            members: members_progress,
        },
        viewer_is_completed,
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
        // Keep status in DB as 'active' so the Lazy Tri challenge remains active
        // in the room for all squad members during October
        conn.execute(
            "UPDATE goals SET status = 'active' WHERE id = ?",
            params![gid],
        )?;
    }

    Ok(())
}

pub fn get_goals_for_room(
    conn: &Connection,
    room_slug: &str,
    viewer_user_token: Option<&str>,
) -> Result<(Vec<Goal>, Vec<Goal>)> {
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
            if let Ok((comp_progress, is_viewer_completed)) =
                compute_composite_progress_for_goal(conn, g.id, room_slug, viewer_user_token)
            {
                let viewer_eff = comp_progress.swim_current.min(comp_progress.swim_target)
                    + comp_progress.bike_current.min(comp_progress.bike_target)
                    + comp_progress.run_current.min(comp_progress.run_target);
                g.current_value = (viewer_eff * 100.0).round() / 100.0;
                if is_viewer_completed {
                    g.status = "completed".to_string();
                }
                g.composite_progress = Some(comp_progress);
            }

            // Always keep Lazy Tri in active_goals during October so diorama & teammate tracking are visible
            active.push(g.clone());
            // And if viewer has completed their individual Lazy Tri, also award trophy in completed_goals
            if g.status == "completed" {
                completed.push(g);
            }
        } else if g.status == "completed" {
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
        if let Ok((comp_progress, _)) =
            compute_composite_progress_for_goal(conn, id, room_slug, None)
        {
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
