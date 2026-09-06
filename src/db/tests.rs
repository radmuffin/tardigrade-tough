use super::*;
use crate::models::*;
use rusqlite::{params, Connection};

fn setup_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("failed to open in-memory db");
    init_db(&mut conn).expect("failed to init db");
    conn
}

#[test]
fn test_generate_solo_room_slug() {
    let slug1 = generate_solo_room_slug("user_abc123");
    let slug2 = generate_solo_room_slug("user_abc123");
    let slug3 = generate_solo_room_slug("user_xyz789");

    assert_eq!(
        slug1, slug2,
        "Same token must yield deterministic solo slug"
    );
    assert_ne!(
        slug1, slug3,
        "Different tokens must yield different solo slugs"
    );
    assert!(
        slug1.starts_with("solo-"),
        "Solo slug must start with 'solo-' prefix"
    );
    assert_eq!(
        slug1.len(),
        11,
        "Solo slug length must be 'solo-' prefix (5) + 6 hex chars"
    );
}

#[test]
fn test_init_db_and_seed_defaults() {
    let conn = setup_test_db();

    // Verify room creation and default goals
    let room = get_or_create_room(&conn, "test-squad").expect("room creation failed");
    assert_eq!(room.slug, "test-squad");
    assert!(room.keep_departed_contributions);

    let (active_goals, completed_goals) =
        get_goals_for_room(&conn, "test-squad").expect("goals query failed");
    assert_eq!(
        active_goals.len(),
        3,
        "Should seed 3 active default goals (Pando, Caribou, Everest)"
    );
    assert_eq!(
        completed_goals.len(),
        1,
        "Should seed 1 conquered benchmark (The Blue Whale)"
    );
}

#[test]
fn test_update_room_departure_policy() {
    let conn = setup_test_db();
    let creator_token = "token-policy-creator";
    let squad = create_room_for_user(&conn, creator_token, Some("Policy Squad")).unwrap();

    // Default is true
    let updated = update_room_settings(&conn, &squad.slug, creator_token, false)
        .expect("failed to update policy");
    assert!(!updated.keep_departed_contributions);

    let fetched = get_or_create_room(&conn, &squad.slug).unwrap();
    assert!(!fetched.keep_departed_contributions);

    let updated_back = update_room_settings(&conn, &squad.slug, creator_token, true).unwrap();
    assert!(updated_back.keep_departed_contributions);
}

#[test]
fn test_user_streak_calculation_unit() {
    let conn = setup_test_db();
    let token = "token-streak-unit";
    let user = get_or_create_user(&conn, token, "solo-streak").expect("user creation failed");
    assert_eq!(user.streak_days, 0);
    assert_eq!(user.tardigrade_state, "cryptobiosis");

    // Streak with no activities should be 0 / cryptobiosis
    let (streak, state) = calculate_user_streak(&conn, token);
    assert_eq!(streak, 0);
    assert_eq!(state, "cryptobiosis");

    // Log an activity for today
    let today = chrono::Utc::now().to_rfc3339();
    conn.execute(
        r#"INSERT INTO activities (room_slug, user_token, user_nickname, user_avatar_color, activity_type, exercise_name, sets, reps, weight_per_rep, total_metric, created_at)
           VALUES ('solo-streak', ?, 'Athlete', '#10b981', 'weight', 'Squat', 3, 10, 100, 3000, ?)"#,
        params![token, today],
    ).expect("failed to insert activity");

    let (streak_after, state_after) = calculate_user_streak(&conn, token);
    assert_eq!(streak_after, 1);
    assert_eq!(state_after, "hydrated");
}

#[test]
fn test_personal_record_engine_unit() {
    let conn = setup_test_db();
    let token = "token-pr-unit";
    let _ = get_or_create_user(&conn, token, "solo-pr").unwrap();

    // Log weight workout
    conn.execute(
        r#"INSERT INTO activities (room_slug, user_token, user_nickname, user_avatar_color, activity_type, exercise_name, sets, reps, weight_per_rep, total_metric, is_pr, created_at)
           VALUES ('solo-pr', ?, 'Athlete', '#10b981', 'weight', 'Bench Press', 3, 5, 225.0, 3375.0, 1, '2026-09-01T10:00:00Z')"#,
        params![token],
    ).unwrap();

    // Log distance workout
    conn.execute(
        r#"INSERT INTO activities (room_slug, user_token, user_nickname, user_avatar_color, activity_type, exercise_name, sets, reps, distance_val, total_metric, is_pr, created_at)
           VALUES ('solo-pr', ?, 'Athlete', '#10b981', 'distance', 'Morning Trail Run', 1, 1, 10.5, 10.5, 1, '2026-09-02T10:00:00Z')"#,
        params![token],
    ).unwrap();

    let prs = get_user_personal_records(&conn, token).expect("failed to get PRs");
    assert_eq!(prs.len(), 2);

    let bench_pr = prs
        .iter()
        .find(|p| p.exercise_name == "Bench Press")
        .unwrap();
    assert_eq!(bench_pr.max_weight, 225.0);

    let run_pr = prs
        .iter()
        .find(|p| p.exercise_name == "Morning Trail Run")
        .unwrap();
    assert_eq!(run_pr.max_distance, 10.5);
}

#[test]
fn test_private_workout_isolation_unit() {
    let mut conn = setup_test_db();
    let token = "token-privacy-unit";
    let solo_room = generate_solo_room_slug(token);
    let user = get_or_create_user(&conn, token, &solo_room).unwrap();

    // Create squad
    let squad = create_room_for_user(&conn, token, Some("Privacy Crew")).unwrap();
    let squad_slug = squad.slug.clone();

    // 1. Log a private workout in solo room
    let priv_req = LogActivityRequest {
        room_slug: Some(solo_room.clone()),
        user_nickname: Some(user.nickname.clone()),
        user_avatar_color: Some(user.avatar_color.clone()),
        user_avatar_emoji: Some(user.avatar_emoji.clone()),
        goal_id: None,
        activity_type: "weight".to_string(),
        exercise_name: Some("Secret Overhead Press".to_string()),
        sets: Some(3),
        reps: Some(8),
        weight_per_rep: Some(135.0),
        distance_val: Some(0.0),
        elevation_val: Some(0.0),
        total_metric: None,
        notes: Some("Private set".to_string()),
        created_at: None,
        parent_activity_id: None,
        is_pr: Some(true),
        is_combined: Some(false),
        is_private: Some(true),
    };

    let priv_act = log_single_activity(&mut conn, &user, &solo_room, &priv_req).unwrap();
    assert!(priv_act.is_private);

    // Must NOT be replicated to squad
    let squad_activities = get_recent_activities(&conn, &squad_slug, 20).unwrap();
    assert!(
        squad_activities
            .iter()
            .all(|a| a.exercise_name != "Secret Overhead Press"),
        "Private workout must not be replicated to squad"
    );

    // 2. Toggle private to public
    let toggled_act = toggle_activity_private(&mut conn, priv_act.id, token)
        .unwrap()
        .expect("activity not found");
    assert!(!toggled_act.is_private);

    // Now it should be replicated to squad
    let squad_activities_after = get_recent_activities(&conn, &squad_slug, 20).unwrap();
    assert!(
        squad_activities_after
            .iter()
            .any(|a| a.exercise_name == "Secret Overhead Press"),
        "Toggled public workout should now replicate to squad"
    );
}

#[test]
fn test_departed_member_purge_unit() {
    let mut conn = setup_test_db();
    let owner_token = "token-owner-unit";
    let member_token = "token-member-unit";

    let squad = create_room_for_user(&conn, owner_token, Some("Departure Squad")).unwrap();
    let squad_slug = squad.slug.clone();

    let member_user = get_or_create_user(&conn, member_token, &squad_slug).unwrap();
    ensure_room_member(&conn, &squad_slug, member_token).unwrap();

    // Member logs 5,000 lbs lift
    let lift_req = LogActivityRequest {
        room_slug: Some(squad_slug.clone()),
        user_nickname: Some(member_user.nickname.clone()),
        user_avatar_color: Some(member_user.avatar_color.clone()),
        user_avatar_emoji: Some(member_user.avatar_emoji.clone()),
        goal_id: None,
        activity_type: "weight".to_string(),
        exercise_name: Some("Heavy Deadlift".to_string()),
        sets: Some(5),
        reps: Some(10),
        weight_per_rep: Some(100.0),
        distance_val: Some(0.0),
        elevation_val: Some(0.0),
        total_metric: None,
        notes: Some("Big lift".to_string()),
        created_at: None,
        parent_activity_id: None,
        is_pr: Some(true),
        is_combined: Some(false),
        is_private: Some(false),
    };
    let _ = log_single_activity(&mut conn, &member_user, &squad_slug, &lift_req).unwrap();

    // Verify Pando goal increased
    let (active_goals, _) = get_goals_for_room(&conn, &squad_slug).unwrap();
    let pando = active_goals
        .iter()
        .find(|g| g.theme_key == "pando")
        .unwrap();
    assert_eq!(pando.current_value, 5000.0);

    // Remove member with keep_contributions = false (Purge)
    remove_room_member(&conn, &squad_slug, owner_token, member_token, false).unwrap();

    // Verify Pando goal was rolled back to 0.0
    let (active_goals_after, _) = get_goals_for_room(&conn, &squad_slug).unwrap();
    let pando_after = active_goals_after
        .iter()
        .find(|g| g.theme_key == "pando")
        .unwrap();
    assert_eq!(
        pando_after.current_value, 0.0,
        "Purging departed member contributions must roll back goal"
    );
}

#[test]
fn test_personal_record_replacement_unit() {
    let conn = setup_test_db();
    let token = "token-pr-replacement";
    let _ = get_or_create_user(&conn, token, "solo-pr2").unwrap();

    // 1st Bench Press at 200 lbs
    conn.execute(
        r#"INSERT INTO activities (room_slug, user_token, user_nickname, user_avatar_color, activity_type, exercise_name, sets, reps, weight_per_rep, total_metric, is_pr, created_at)
           VALUES ('solo-pr2', ?, 'Athlete', '#10b981', 'weight', 'Bench Press', 1, 5, 200.0, 1000.0, 1, '2026-09-01T10:00:00Z')"#,
        params![token],
    ).unwrap();

    // 2nd Bench Press at 225 lbs (New PR)
    conn.execute(
        r#"INSERT INTO activities (room_slug, user_token, user_nickname, user_avatar_color, activity_type, exercise_name, sets, reps, weight_per_rep, total_metric, is_pr, created_at)
           VALUES ('solo-pr2', ?, 'Athlete', '#10b981', 'weight', 'Bench Press', 1, 5, 225.0, 1125.0, 1, '2026-09-02T10:00:00Z')"#,
        params![token],
    ).unwrap();

    let prs = get_user_personal_records(&conn, token).unwrap();
    let bench_pr = prs
        .iter()
        .find(|p| p.exercise_name == "Bench Press")
        .unwrap();
    assert_eq!(
        bench_pr.max_weight, 225.0,
        "PR should be the maximum weight recorded"
    );
}

#[test]
fn test_create_custom_goal_and_recalculate() {
    let conn = setup_test_db();
    let token = "token-custom-goal";
    let squad = create_room_for_user(&conn, token, Some("Custom Goal Squad")).unwrap();

    let req = CreateGoalRequest {
        room_slug: Some(squad.slug.clone()),
        title: "Olympus Mons Stairmaster".to_string(),
        category: "elevation".to_string(),
        target_value: 70000.0,
        unit: "ft".to_string(),
        theme_key: Some("volcano".to_string()),
        description: Some("Conquering the tallest volcano in the solar system".to_string()),
    };

    let goal = create_custom_goal(&conn, &squad.slug, &req).unwrap();
    assert_eq!(goal.title, "Olympus Mons Stairmaster");
    assert_eq!(goal.target_value, 70000.0);
    assert_eq!(goal.theme_key, "volcano");
    assert_eq!(goal.status, "active");

    // Recalculating with no activities preserves current_value 0.0
    recalculate_room_goals(&conn, &squad.slug).unwrap();
    let (active_goals, _) = get_goals_for_room(&conn, &squad.slug).unwrap();
    let found = active_goals.iter().find(|g| g.id == goal.id).unwrap();
    assert_eq!(found.current_value, 0.0);
}

#[test]
fn test_wishlist_submission_and_query_unit() {
    let conn = setup_test_db();
    let token = "token-wishlist-unit";
    let squad = create_room_for_user(&conn, token, Some("Wishlist Squad")).unwrap();

    let req = CreateGoalWishlistRequest {
        room_slug: squad.slug.clone(),
        title: "Denali Traverse".to_string(),
        category: "elevation".to_string(),
        target_value: 20310.0,
        unit: "ft".to_string(),
        notes: Some("North America summit challenge".to_string()),
        user_nickname: Some("Explorer".to_string()),
    };

    let item = create_goal_wishlist(&conn, token, &req).unwrap();
    assert_eq!(item.title, "Denali Traverse");
    assert_eq!(item.target_value, 20310.0);

    let items = get_wishlists(&conn, &squad.slug).unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].title, "Denali Traverse");
    assert_eq!(items[0].user_nickname, "Explorer");
}

#[test]
fn test_user_profile_avatar_and_color_persistence() {
    let conn = setup_test_db();
    let token = "token-avatar-unit";
    let user = get_or_create_user(&conn, token, "solo-avatar").unwrap();
    assert!(user.avatar_color.starts_with('#'));

    let req = UpdateProfileRequest {
        nickname: Some("Iron Bear".to_string()),
        avatar_color: Some("#ec4899".to_string()),
        avatar_emoji: Some("🐻".to_string()),
        current_room_slug: None,
    };

    let updated = update_user_profile(&conn, token, &req).unwrap();
    assert_eq!(updated.nickname, "Iron Bear");
    assert_eq!(updated.avatar_color, "#ec4899");
    assert_eq!(updated.avatar_emoji, "🐻");

    // Query back from DB
    let re_fetched = get_or_create_user(&conn, token, "solo-avatar").unwrap();
    assert_eq!(re_fetched.nickname, "Iron Bear");
    assert_eq!(re_fetched.avatar_color, "#ec4899");
    assert_eq!(re_fetched.avatar_emoji, "🐻");
}
