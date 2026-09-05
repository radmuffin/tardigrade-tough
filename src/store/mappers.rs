use crate::models::*;
use rusqlite::{Result, Row};

pub fn map_room(row: &Row) -> Result<Room> {
    Ok(Room {
        id: row.get(0)?,
        slug: row.get(1)?,
        name: row.get(2)?,
        created_at: row.get(3)?,
        creator_token: row.get(4).unwrap_or_default(),
    })
}

pub fn map_goal(row: &Row) -> Result<Goal> {
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
}

pub fn map_activity(row: &Row) -> Result<Activity> {
    Ok(Activity {
        id: row.get(0)?,
        room_slug: row.get(1)?,
        user_token: row.get(2)?,
        user_nickname: row.get(3)?,
        user_avatar_color: row.get(4)?,
        user_avatar_emoji: row.get(5).unwrap_or_default(),
        goal_id: row.get(6)?,
        activity_type: row.get(7)?,
        exercise_name: row.get(8)?,
        sets: row.get(9)?,
        reps: row.get(10)?,
        weight_per_rep: row.get(11)?,
        distance_val: row.get(12)?,
        elevation_val: row.get(13)?,
        total_metric: row.get(14)?,
        notes: row.get(15)?,
        created_at: row.get(16)?,
        parent_activity_id: row.get(17).unwrap_or(None),
        is_pr: row.get::<_, i32>(18).unwrap_or(0) == 1,
    })
}

pub fn map_wishlist_item(row: &Row) -> Result<GoalWishlistItem> {
    Ok(GoalWishlistItem {
        id: row.get(0)?,
        user_token: row.get(1)?,
        user_nickname: row.get(2)?,
        room_slug: row.get(3)?,
        title: row.get(4)?,
        category: row.get(5)?,
        target_value: row.get(6)?,
        unit: row.get(7)?,
        notes: row.get(8)?,
        created_at: row.get(9)?,
    })
}

pub fn map_user_squad_summary(row: &Row) -> Result<UserSquadSummary> {
    let slug: String = row.get(0)?;
    let name: String = row.get(1)?;
    let role: String = row.get(2)?;
    let is_creator: bool = row.get(3)?;
    let member_count: i64 = row.get(4)?;
    let joined_at: String = row.get(5)?;

    Ok(UserSquadSummary {
        slug,
        name,
        role,
        is_creator,
        member_count,
        joined_at,
    })
}

pub fn map_personal_record(row: &Row) -> Result<PersonalRecord> {
    Ok(PersonalRecord {
        exercise_name: row.get(0)?,
        activity_type: row.get(1)?,
        max_weight: row.get(2)?,
        max_reps: row.get(3)?,
        max_distance: row.get(4)?,
        max_elevation: row.get(5)?,
    })
}

pub fn map_user_profile(
    row: &Row,
    streak_days: i32,
    tardigrade_state: String,
) -> Result<UserProfile> {
    Ok(UserProfile {
        user_token: row.get(0)?,
        nickname: row.get(1)?,
        avatar_color: row.get(2)?,
        avatar_emoji: row.get(3)?,
        current_room_slug: row.get(4)?,
        updated_at: row.get(5)?,
        streak_days,
        tardigrade_state,
        personal_stats: UserPersonalStats::default(),
    })
}
