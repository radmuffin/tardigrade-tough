use crate::db::*;
use crate::models::*;
use crate::store::mappers::*;
use chrono::Utc;
use rusqlite::{params, Connection, Result};

pub fn get_departed_contributors(
    conn: &Connection,
    room_slug: &str,
) -> Result<Vec<DepartedContributor>> {
    let mut stmt = conn.prepare(
        r#"SELECT
            a.user_token,
            COALESCE(
                NULLIF((SELECT a2.user_nickname FROM activities a2 WHERE a2.user_token = a.user_token AND a2.room_slug = a.room_slug AND NULLIF(a2.user_nickname, '') IS NOT NULL ORDER BY a2.id DESC LIMIT 1), ''),
                NULLIF(u.nickname, ''),
                'Former Member'
            ) as nick,
            COALESCE(
                NULLIF((SELECT a2.user_avatar_color FROM activities a2 WHERE a2.user_token = a.user_token AND a2.room_slug = a.room_slug AND NULLIF(a2.user_avatar_color, '') IS NOT NULL ORDER BY a2.id DESC LIMIT 1), ''),
                NULLIF(u.avatar_color, ''),
                '#64748b'
            ) as col,
            COALESCE(
                NULLIF((SELECT a2.user_avatar_emoji FROM activities a2 WHERE a2.user_token = a.user_token AND a2.room_slug = a.room_slug AND NULLIF(a2.user_avatar_emoji, '') IS NOT NULL ORDER BY a2.id DESC LIMIT 1), ''),
                NULLIF(u.avatar_emoji, ''),
                ''
            ) as emoji,
            COALESCE(SUM(a.total_metric), 0.0) as total_metric,
            COALESCE(COUNT(*), 0) as total_sets
           FROM activities a
           LEFT JOIN users u ON a.user_token = u.user_token
           WHERE a.room_slug = ? AND a.user_token NOT IN (SELECT user_token FROM room_members WHERE room_slug = ?)
           GROUP BY a.user_token
           ORDER BY total_metric DESC"#
    )?;

    let rows = stmt.query_map(params![room_slug, room_slug], |row| {
        Ok(DepartedContributor {
            user_token: row.get(0)?,
            nickname: row.get(1)?,
            avatar_color: row.get(2)?,
            avatar_emoji: row.get(3)?,
            total_metric: row.get(4)?,
            total_sets: row.get(5)?,
        })
    })?;

    Ok(rows.filter_map(Result::ok).collect())
}

pub fn purge_member_contributions(
    conn: &Connection,
    room_slug: &str,
    creator_token: &str,
    target_token: &str,
) -> std::result::Result<(), String> {
    let current_creator: String = conn
        .query_row(
            "SELECT COALESCE(creator_token, '') FROM rooms WHERE slug = ?",
            params![room_slug],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    if current_creator != creator_token {
        return Err("Only the squad creator can purge member contributions".to_string());
    }

    conn.execute(
        "DELETE FROM activities WHERE room_slug = ? AND user_token = ?",
        params![room_slug, target_token],
    )
    .map_err(|e| e.to_string())?;

    recalculate_room_goals(conn, room_slug).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn sync_user_activities_to_room(
    conn: &Connection,
    user_token: &str,
    target_room_slug: &str,
) -> Result<i64> {
    if target_room_slug.starts_with("solo-") {
        return Ok(0);
    }

    let mut stmt = conn.prepare(
        r#"SELECT id, user_nickname, user_avatar_color, COALESCE(user_avatar_emoji, ''),
                  activity_type, exercise_name, sets, reps, weight_per_rep, distance_val,
                  elevation_val, total_metric, notes, created_at, COALESCE(is_pr, 0), COALESCE(is_combined, 0)
           FROM activities r
           WHERE r.user_token = ?
             AND COALESCE(r.is_private, 0) = 0
             AND (r.parent_activity_id IS NULL OR r.parent_activity_id = 0)
             AND NOT EXISTS (
                 SELECT 1 FROM activities c
                 WHERE c.room_slug = ?
                   AND (c.parent_activity_id = r.id OR c.id = r.id)
             )
           ORDER BY r.id ASC"#,
    )?;

    struct RootAct {
        id: i64,
        user_nickname: String,
        user_avatar_color: String,
        user_avatar_emoji: String,
        activity_type: String,
        exercise_name: String,
        sets: i32,
        reps: i32,
        weight_per_rep: f64,
        distance_val: f64,
        elevation_val: f64,
        total_metric: f64,
        notes: String,
        created_at: String,
        is_pr: i32,
        is_combined: i32,
    }

    let missing_rows = stmt
        .query_map(params![user_token, target_room_slug], |row| {
            Ok(RootAct {
                id: row.get(0)?,
                user_nickname: row.get(1)?,
                user_avatar_color: row.get(2)?,
                user_avatar_emoji: row.get(3)?,
                activity_type: row.get(4)?,
                exercise_name: row.get(5)?,
                sets: row.get(6)?,
                reps: row.get(7)?,
                weight_per_rep: row.get(8)?,
                distance_val: row.get(9)?,
                elevation_val: row.get(10)?,
                total_metric: row.get(11)?,
                notes: row.get(12)?,
                created_at: row.get(13)?,
                is_pr: row.get(14)?,
                is_combined: row.get(15)?,
            })
        })?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    if missing_rows.is_empty() {
        return Ok(0);
    }

    let mut count = 0;
    for act in missing_rows {
        let goal_id: Option<i64> = conn
            .query_row(
                "SELECT id FROM goals WHERE room_slug = ? AND category = ? AND status = 'active' ORDER BY id ASC LIMIT 1",
                params![target_room_slug, act.activity_type],
                |r| r.get(0),
            )
            .ok();

        conn.execute(
            r#"INSERT INTO activities
               (room_slug, user_token, user_nickname, user_avatar_color, user_avatar_emoji, goal_id,
                activity_type, exercise_name, sets, reps, weight_per_rep, distance_val, elevation_val,
                total_metric, notes, created_at, parent_activity_id, is_pr, is_combined, is_private)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)"#,
            params![
                target_room_slug,
                user_token,
                act.user_nickname,
                act.user_avatar_color,
                act.user_avatar_emoji,
                goal_id,
                act.activity_type,
                act.exercise_name,
                act.sets,
                act.reps,
                act.weight_per_rep,
                act.distance_val,
                act.elevation_val,
                act.total_metric,
                act.notes,
                act.created_at,
                act.id,
                act.is_pr,
                act.is_combined,
            ],
        )?;
        count += 1;
    }

    let _ = recalculate_room_goals(conn, target_room_slug);

    Ok(count)
}

pub fn log_single_activity(
    conn: &mut Connection,
    user: &UserProfile,
    room_slug: &str,
    req: &LogActivityRequest,
) -> Result<Activity> {
    let is_private = req.is_private.unwrap_or(false);
    let target_room = if is_private {
        generate_solo_room_slug(&user.user_token)
    } else {
        room_slug.to_string()
    };

    get_or_create_room(conn, &target_room)?;
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
            "ability" => 1.0,
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
            "ability" => "Feat",
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
            .query_row(params![target_room, activity_type], |r| r.get(0))
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

    if let Some(explicit_nick) = req.user_nickname.as_deref() {
        let clean_nick = explicit_nick.trim();
        if !clean_nick.is_empty() && clean_nick != user.nickname {
            let _ = tx.execute(
                "UPDATE users SET nickname = ? WHERE user_token = ?",
                params![clean_nick, user.user_token],
            );
        }
    }
    if let Some(explicit_color) = req.user_avatar_color.as_deref() {
        let clean_color = explicit_color.trim();
        if !clean_color.is_empty() && clean_color != user.avatar_color {
            let _ = tx.execute(
                "UPDATE users SET avatar_color = ? WHERE user_token = ?",
                params![clean_color, user.user_token],
            );
        }
    }
    if let Some(explicit_emoji) = req.user_avatar_emoji.as_deref() {
        let clean_emoji = explicit_emoji.trim();
        if !clean_emoji.is_empty() && clean_emoji != user.avatar_emoji {
            let _ = tx.execute(
                "UPDATE users SET avatar_emoji = ? WHERE user_token = ?",
                params![clean_emoji, user.user_token],
            );
        }
    }
    let notes = req.notes.as_deref().unwrap_or("").trim();
    let parent_activity_id = req.parent_activity_id;
    let is_combined = req.is_combined.unwrap_or(false);

    let is_pr = if is_combined {
        false
    } else if let Some(explicit_pr) = req.is_pr {
        explicit_pr
    } else {
        let clean_exercise = exercise_name.trim().to_lowercase();
        match activity_type.as_str() {
            "weight" => {
                if weight_per_rep > 0.0 {
                    let prev_max: f64 = tx
                        .query_row(
                            "SELECT COALESCE(MAX(weight_per_rep), 0.0) FROM activities WHERE user_token = ? AND LOWER(TRIM(exercise_name)) = ? AND COALESCE(is_combined, 0) = 0",
                            params![user.user_token, clean_exercise],
                            |r| r.get(0),
                        )
                        .unwrap_or(0.0);
                    weight_per_rep > prev_max
                } else {
                    let prev_max_reps: i32 = tx
                        .query_row(
                            "SELECT COALESCE(MAX(reps), 0) FROM activities WHERE user_token = ? AND LOWER(TRIM(exercise_name)) = ? AND weight_per_rep = 0.0 AND COALESCE(is_combined, 0) = 0",
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
                        "SELECT COALESCE(MAX(distance_val), 0.0) FROM activities WHERE user_token = ? AND LOWER(TRIM(exercise_name)) = ? AND COALESCE(is_combined, 0) = 0",
                        params![user.user_token, clean_exercise],
                        |r| r.get(0),
                    )
                    .unwrap_or(0.0);
                distance_val > prev_max
            }
            "elevation" if elevation_val > 0.0 => {
                let prev_max: f64 = tx
                    .query_row(
                        "SELECT COALESCE(MAX(elevation_val), 0.0) FROM activities WHERE user_token = ? AND LOWER(TRIM(exercise_name)) = ? AND COALESCE(is_combined, 0) = 0",
                        params![user.user_token, clean_exercise],
                        |r| r.get(0),
                    )
                    .unwrap_or(0.0);
                elevation_val > prev_max
            }
            "ability" => {
                let prev_count: i64 = tx
                    .query_row(
                        "SELECT COUNT(*) FROM activities WHERE user_token = ? AND LOWER(TRIM(exercise_name)) = ? AND activity_type = 'ability' AND COALESCE(is_combined, 0) = 0",
                        params![user.user_token, clean_exercise],
                        |r| r.get(0),
                    )
                    .unwrap_or(0);
                prev_count == 0
            }
            _ => false,
        }
    };

    tx.execute(
        r#"INSERT INTO activities 
           (room_slug, user_token, user_nickname, user_avatar_color, user_avatar_emoji, goal_id, activity_type, exercise_name, sets, reps, weight_per_rep, distance_val, elevation_val, total_metric, notes, created_at, parent_activity_id, is_pr, is_combined, is_private)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        params![
            target_room,
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
            if is_pr { 1 } else { 0 },
            if is_combined { 1 } else { 0 },
            if is_private { 1 } else { 0 }
        ],
    )?;

    let id = tx.last_insert_rowid();
    tx.commit()?;

    Ok(Activity {
        id,
        room_slug: target_room,
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
        is_combined,
        is_private,
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
            "SELECT id, goal_id, total_metric, user_token, room_slug, parent_activity_id FROM activities WHERE id = ?",
        )?;
        stmt.query_row(params![activity_id], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, Option<i64>>(1)?,
                r.get::<_, f64>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, Option<i64>>(5)?,
            ))
        })
    };

    if let Ok((_act_id, goal_id, total_metric, owner_token, room_slug, parent_activity_id)) = found
    {
        // Only owner can delete
        if owner_token != user_token {
            return Ok(None);
        }

        let root_id = parent_activity_id.unwrap_or(activity_id);
        let mut affected_rooms = vec![room_slug.clone()];

        // Find root activity if we started from a child
        if let Some(pid) = parent_activity_id {
            let root_info = {
                let mut r_stmt = tx.prepare("SELECT goal_id, total_metric, room_slug FROM activities WHERE id = ? AND user_token = ?")?;
                r_stmt
                    .query_row(params![pid, user_token], |r| {
                        Ok((
                            r.get::<_, Option<i64>>(0)?,
                            r.get::<_, f64>(1)?,
                            r.get::<_, String>(2)?,
                        ))
                    })
                    .ok()
            };
            if let Some((r_gid, r_metric, r_room)) = root_info {
                if let Some(gid) = r_gid {
                    tx.execute(
                        "UPDATE goals SET current_value = MAX(0.0, current_value - ?) WHERE id = ?",
                        params![r_metric, gid],
                    )?;
                    tx.execute("UPDATE goals SET status = 'active' WHERE id = ? AND current_value < target_value AND status = 'completed'", params![gid])?;
                }
                tx.execute("DELETE FROM activities WHERE id = ?", params![pid])?;
                if !affected_rooms.contains(&r_room) {
                    affected_rooms.push(r_room);
                }
            }
        }

        // Find any child activities forwarded from this root activity
        let child_rows = {
            let mut child_stmt = tx.prepare(
                "SELECT id, goal_id, total_metric, room_slug FROM activities WHERE parent_activity_id = ? AND user_token = ?",
            )?;
            let rows = child_stmt
                .query_map(params![root_id, user_token], |r| {
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
                    "UPDATE goals SET current_value = MAX(0.0, current_value - ?) WHERE id = ?",
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
                "UPDATE goals SET current_value = MAX(0.0, current_value - ?) WHERE id = ?",
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

pub fn toggle_activity_pr(
    conn: &mut Connection,
    activity_id: i64,
    user_token: &str,
) -> Result<Option<Activity>> {
    let tx = conn.transaction()?;
    let current = tx.query_row(
        "SELECT id, room_slug, is_pr, is_combined FROM activities WHERE id = ? AND user_token = ?",
        params![activity_id, user_token],
        |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i32>(2)?,
                r.get::<_, i32>(3)?,
            ))
        },
    );

    let (act_id, _room_slug, is_pr_val, is_comb_val) = match current {
        Ok(v) => v,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(e),
    };

    let new_is_pr = if is_pr_val == 1 { 0 } else { 1 };
    let new_is_combined = if new_is_pr == 1 { 0 } else { is_comb_val };

    tx.execute(
        "UPDATE activities SET is_pr = ?, is_combined = ? WHERE id = ?",
        params![new_is_pr, new_is_combined, act_id],
    )?;

    // Also update any child activities forwarded from this parent
    let _ = tx.execute(
        "UPDATE activities SET is_pr = ?, is_combined = ? WHERE parent_activity_id = ? AND user_token = ?",
        params![new_is_pr, new_is_combined, act_id, user_token],
    );

    let updated_act = tx.query_row(
        r#"SELECT id, room_slug, user_token, user_nickname, user_avatar_color, COALESCE(user_avatar_emoji, ''), goal_id, activity_type, exercise_name, sets, reps, weight_per_rep, distance_val, elevation_val, total_metric, notes, created_at, parent_activity_id, COALESCE(is_pr, 0), COALESCE(is_combined, 0), COALESCE(is_private, 0)
           FROM activities WHERE id = ?"#,
        params![act_id],
        map_activity,
    )?;

    tx.commit()?;
    Ok(Some(updated_act))
}

pub fn update_activity(
    conn: &mut Connection,
    activity_id: i64,
    user_token: &str,
    req: &UpdateActivityRequest,
) -> Result<Option<Activity>> {
    let tx = conn.transaction()?;
    let current = tx.query_row(
        r#"SELECT id, room_slug, exercise_name, sets, reps, weight_per_rep, notes, is_pr, is_combined, COALESCE(is_private, 0)
           FROM activities WHERE id = ? AND user_token = ?"#,
        params![activity_id, user_token],
        |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, i32>(3)?,
                r.get::<_, i32>(4)?,
                r.get::<_, f64>(5)?,
                r.get::<_, String>(6)?,
                r.get::<_, i32>(7)?,
                r.get::<_, i32>(8)?,
                r.get::<_, i32>(9)?,
            ))
        },
    );

    let (act_id, _room, cur_ex, cur_sets, cur_reps, cur_wt, cur_notes, cur_pr, cur_comb, cur_priv) =
        match current {
            Ok(v) => v,
            Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
            Err(e) => return Err(e),
        };

    let new_ex = req
        .exercise_name
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .unwrap_or(&cur_ex);
    let new_sets = req.sets.unwrap_or(cur_sets).max(1);
    let new_reps = req.reps.unwrap_or(cur_reps).max(1);
    let new_wt = req.weight_per_rep.unwrap_or(cur_wt).max(0.0);
    let new_notes = req.notes.as_deref().map(|s| s.trim()).unwrap_or(&cur_notes);
    let new_pr = req.is_pr.map(|b| if b { 1 } else { 0 }).unwrap_or(cur_pr);
    let new_comb = req
        .is_combined
        .map(|b| if b { 1 } else { 0 })
        .unwrap_or(cur_comb);
    let new_priv = req
        .is_private
        .map(|b| if b { 1 } else { 0 })
        .unwrap_or(cur_priv);

    tx.execute(
        r#"UPDATE activities 
           SET exercise_name = ?, sets = ?, reps = ?, weight_per_rep = ?, notes = ?, is_pr = ?, is_combined = ?, is_private = ?
           WHERE id = ?"#,
        params![
            new_ex, new_sets, new_reps, new_wt, new_notes, new_pr, new_comb, new_priv, act_id
        ],
    )?;

    if cur_priv == 0 && new_priv == 1 {
        // Toggled to private: purge child copies in squads and recalculate goals
        let child_rooms: Vec<String> = {
            let mut stmt = tx.prepare(
                "SELECT DISTINCT room_slug FROM activities WHERE parent_activity_id = ?",
            )?;
            let rows = stmt.query_map(params![act_id], |r| r.get(0))?;
            rows.filter_map(Result::ok).collect()
        };
        tx.execute(
            "DELETE FROM activities WHERE parent_activity_id = ?",
            params![act_id],
        )?;
        for r in child_rooms {
            let _ = tx.execute(
                r#"UPDATE goals
                   SET current_value = (
                       SELECT COALESCE(SUM(a.total_metric), 0.0)
                       FROM activities a
                       WHERE (a.goal_id = goals.id OR (a.goal_id IS NULL AND a.room_slug = goals.room_slug AND a.activity_type = goals.category))
                   )
                   WHERE room_slug = ?"#,
                params![r],
            );
            let _ = tx.execute(
                "UPDATE goals SET status = 'active' WHERE room_slug = ? AND current_value < target_value AND status = 'completed'",
                params![r],
            );
        }
    } else if cur_priv == 1 && new_priv == 0 {
        // Toggled from private to public: sync to all squads user belongs to
        let squads: Vec<String> = {
            let mut stmt = tx.prepare(
                "SELECT room_slug FROM room_members WHERE user_token = ? AND room_slug NOT LIKE 'solo-%'",
            )?;
            let rows = stmt.query_map(params![user_token], |r| r.get(0))?;
            rows.filter_map(Result::ok).collect()
        };
        for sq in squads {
            let _ = sync_user_activities_to_room(&tx, user_token, &sq);
        }
    } else {
        // Also update any child activities forwarded from this parent
        let _ = tx.execute(
            r#"UPDATE activities 
               SET exercise_name = ?, sets = ?, reps = ?, weight_per_rep = ?, notes = ?, is_pr = ?, is_combined = ?, is_private = ?
               WHERE parent_activity_id = ? AND user_token = ?"#,
            params![
                new_ex, new_sets, new_reps, new_wt, new_notes, new_pr, new_comb, new_priv, act_id, user_token
            ],
        );
    }

    let updated_act = tx.query_row(
        r#"SELECT id, room_slug, user_token, user_nickname, user_avatar_color, COALESCE(user_avatar_emoji, ''), goal_id, activity_type, exercise_name, sets, reps, weight_per_rep, distance_val, elevation_val, total_metric, notes, created_at, parent_activity_id, COALESCE(is_pr, 0), COALESCE(is_combined, 0), COALESCE(is_private, 0)
           FROM activities WHERE id = ?"#,
        params![act_id],
        map_activity,
    )?;

    tx.commit()?;
    Ok(Some(updated_act))
}

pub fn toggle_activity_private(
    conn: &mut Connection,
    activity_id: i64,
    user_token: &str,
) -> Result<Option<Activity>> {
    let current_private: i32 = match conn.query_row(
        "SELECT COALESCE(is_private, 0) FROM activities WHERE id = ? AND user_token = ?",
        params![activity_id, user_token],
        |r| r.get(0),
    ) {
        Ok(v) => v,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(e),
    };

    let new_private = current_private == 0;
    let req = UpdateActivityRequest {
        is_private: Some(new_private),
        ..Default::default()
    };
    update_activity(conn, activity_id, user_token, &req)
}

pub fn get_recent_activities(
    conn: &Connection,
    room_slug: &str,
    limit: i64,
) -> Result<Vec<Activity>> {
    let mut stmt = conn.prepare(
        r#"SELECT id, room_slug, user_token, user_nickname, user_avatar_color, COALESCE(user_avatar_emoji, ''), goal_id, activity_type, exercise_name, sets, reps, weight_per_rep, distance_val, elevation_val, total_metric, notes, created_at, parent_activity_id, COALESCE(is_pr, 0), COALESCE(is_combined, 0), COALESCE(is_private, 0)
           FROM activities WHERE room_slug = ? ORDER BY id DESC LIMIT ?"#,
    )?;

    let rows = stmt.query_map(params![room_slug, limit], map_activity)?;

    Ok(rows.filter_map(Result::ok).collect())
}

pub fn get_leaderboard(conn: &Connection, room_slug: &str) -> Result<Vec<LeaderboardMember>> {
    let mut stmt = conn.prepare(
        r#"SELECT 
            a.user_token,
            COALESCE(
                NULLIF((SELECT a2.user_nickname FROM activities a2 WHERE a2.user_token = a.user_token AND a2.room_slug = a.room_slug AND NULLIF(a2.user_nickname, '') IS NOT NULL ORDER BY a2.id DESC LIMIT 1), ''),
                NULLIF(u.nickname, ''),
                'Lifter'
            ) as nick,
            COALESCE(
                NULLIF((SELECT a2.user_avatar_color FROM activities a2 WHERE a2.user_token = a.user_token AND a2.room_slug = a.room_slug AND NULLIF(a2.user_avatar_color, '') IS NOT NULL ORDER BY a2.id DESC LIMIT 1), ''),
                NULLIF(u.avatar_color, ''),
                '#10b981'
            ) as col,
            COALESCE(
                NULLIF((SELECT a2.user_avatar_emoji FROM activities a2 WHERE a2.user_token = a.user_token AND a2.room_slug = a.room_slug AND NULLIF(a2.user_avatar_emoji, '') IS NOT NULL ORDER BY a2.id DESC LIMIT 1), ''),
                NULLIF(u.avatar_emoji, ''),
                ''
            ) as emoji,
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
            COALESCE(SUM(a.sets), 0) as total_sets
           FROM activities a
           LEFT JOIN users u ON a.user_token = u.user_token
           WHERE a.room_slug = ?
           GROUP BY a.user_token
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
