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
        get_goals_for_room(&conn, "test-squad", None).expect("goals query failed");
    assert_eq!(
        active_goals.len(),
        4,
        "Should seed 4 active default goals (Pando, Caribou, Everest, Lazy Ironman)"
    );
    let ironman = active_goals
        .iter()
        .find(|g| g.theme_key == "ironman")
        .expect("ironman goal seeded");
    assert_eq!(ironman.category, "composite");
    assert_eq!(ironman.target_value, 140.6);
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
    let (active_goals, _) = get_goals_for_room(&conn, &squad_slug, None).unwrap();
    let pando = active_goals
        .iter()
        .find(|g| g.theme_key == "pando")
        .unwrap();
    assert_eq!(pando.current_value, 5000.0);

    // Remove member with keep_contributions = false (Purge)
    remove_room_member(&conn, &squad_slug, owner_token, member_token, false).unwrap();

    // Verify Pando goal was rolled back to 0.0
    let (active_goals_after, _) = get_goals_for_room(&conn, &squad_slug, None).unwrap();
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
    let (active_goals, _) = get_goals_for_room(&conn, &squad.slug, None).unwrap();
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

#[test]
fn test_lazy_ironman_composite_goal_unit() {
    let mut conn = setup_test_db();
    let squad = get_or_create_room(&conn, "tri-squad").unwrap();
    let user = get_or_create_user(&conn, "token-tri", &squad.slug).unwrap();

    let (active_init, _) = get_goals_for_room(&conn, &squad.slug, Some("token-tri")).unwrap();
    let ironman_init = active_init
        .iter()
        .find(|g| g.theme_key == "ironman")
        .expect("ironman seeded");
    assert_eq!(ironman_init.target_value, 140.6);
    let comp_init = ironman_init.composite_progress.as_ref().unwrap();
    assert_eq!(comp_init.swim_target, 2.4);
    assert_eq!(comp_init.bike_target, 112.0);
    assert_eq!(comp_init.run_target, 26.2);
    assert_eq!(comp_init.swim_current, 0.0);
    assert_eq!(comp_init.bike_current, 0.0);
    assert_eq!(comp_init.run_current, 0.0);

    // 1. Log a 5.0 mi Run
    let run_req = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("Marathon Training Run".to_string()),
        distance_val: Some(5.0),
        total_metric: Some(5.0),
        ..Default::default()
    };
    log_single_activity(&mut conn, &user, &squad.slug, &run_req).unwrap();

    let (active_after_run, _) = get_goals_for_room(&conn, &squad.slug, Some("token-tri")).unwrap();
    let caribou = active_after_run
        .iter()
        .find(|g| g.theme_key == "caribou")
        .unwrap();
    assert_eq!(caribou.current_value, 5.0, "Caribou received run distance");
    let ironman = active_after_run
        .iter()
        .find(|g| g.theme_key == "ironman")
        .unwrap();
    assert_eq!(ironman.current_value, 5.0);
    let comp = ironman.composite_progress.as_ref().unwrap();
    assert_eq!(comp.run_current, 5.0);
    assert_eq!(comp.bike_current, 0.0);
    assert_eq!(comp.swim_current, 0.0);

    // 2. Log a 50.0 mi Bike ride
    let bike_req = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("Road Cycling".to_string()),
        distance_val: Some(50.0),
        total_metric: Some(50.0),
        ..Default::default()
    };
    log_single_activity(&mut conn, &user, &squad.slug, &bike_req).unwrap();

    let (active_after_bike, _) = get_goals_for_room(&conn, &squad.slug, Some("token-tri")).unwrap();
    let caribou_b = active_after_bike
        .iter()
        .find(|g| g.theme_key == "caribou")
        .unwrap();
    assert_eq!(
        caribou_b.current_value, 55.0,
        "Caribou received bike distance"
    );
    let ironman_b = active_after_bike
        .iter()
        .find(|g| g.theme_key == "ironman")
        .unwrap();
    assert_eq!(ironman_b.current_value, 55.0);
    let comp_b = ironman_b.composite_progress.as_ref().unwrap();
    assert_eq!(comp_b.bike_current, 50.0);
    assert_eq!(comp_b.run_current, 5.0);

    // 3. Log a 1.0 mi Swim
    let swim_req = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("Pool Swim - Freestyle Laps".to_string()),
        distance_val: Some(1.0),
        total_metric: Some(1.0),
        ..Default::default()
    };
    log_single_activity(&mut conn, &user, &squad.slug, &swim_req).unwrap();

    let (active_after_swim, _) = get_goals_for_room(&conn, &squad.slug, Some("token-tri")).unwrap();
    let caribou_s = active_after_swim
        .iter()
        .find(|g| g.theme_key == "caribou")
        .unwrap();
    assert_eq!(
        caribou_s.current_value, 56.0,
        "Caribou received swim distance"
    );
    let ironman_s = active_after_swim
        .iter()
        .find(|g| g.theme_key == "ironman")
        .unwrap();
    assert_eq!(ironman_s.current_value, 56.0);
    let comp_s = ironman_s.composite_progress.as_ref().unwrap();
    assert_eq!(comp_s.swim_current, 1.0);

    // 4. Overfill Bike Leg: Log 200 mi more bike ride (total 250 mi bike)
    let mega_bike = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("Century Ride".to_string()),
        distance_val: Some(200.0),
        total_metric: Some(200.0),
        ..Default::default()
    };
    log_single_activity(&mut conn, &user, &squad.slug, &mega_bike).unwrap();

    let (active_over, _) = get_goals_for_room(&conn, &squad.slug, Some("token-tri")).unwrap();
    let ironman_over = active_over
        .iter()
        .find(|g| g.theme_key == "ironman")
        .unwrap();
    let comp_over = ironman_over.composite_progress.as_ref().unwrap();
    assert_eq!(comp_over.bike_current, 250.0);
    // Effective capped contribution = 112.0 (bike cap) + 5.0 (run) + 1.0 (swim) = 118.0
    assert_eq!(ironman_over.current_value, 118.0);
    assert_eq!(
        ironman_over.status, "active",
        "Goal not completed yet because swim & run remain"
    );

    // 5. Complete Swim (1.4 mi) and Run (21.2 mi)
    let finish_swim = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("Open Water Swim".to_string()),
        distance_val: Some(1.4),
        total_metric: Some(1.4),
        ..Default::default()
    };
    log_single_activity(&mut conn, &user, &squad.slug, &finish_swim).unwrap();

    let finish_run = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("Long Marathon Run".to_string()),
        distance_val: Some(21.2),
        total_metric: Some(21.2),
        ..Default::default()
    };
    log_single_activity(&mut conn, &user, &squad.slug, &finish_run).unwrap();

    let (active_final, completed_final) =
        get_goals_for_room(&conn, &squad.slug, Some("token-tri")).unwrap();
    let ironman_active = active_final
        .iter()
        .find(|g| g.theme_key == "ironman")
        .expect("Ironman remains in active goals so diorama & teammates remain accessible");
    assert_eq!(ironman_active.status, "completed");
    assert_eq!(ironman_active.current_value, 140.6);
    assert!(
        ironman_active
            .composite_progress
            .as_ref()
            .unwrap()
            .is_completed
    );

    let conquered_ironman = completed_final
        .iter()
        .find(|g| g.theme_key == "ironman")
        .expect("conquered ironman in completed list");
    assert_eq!(conquered_ironman.status, "completed");
    assert_eq!(conquered_ironman.current_value, 140.6);
}

#[test]
fn test_lazy_tri_october_date_bounds() {
    let mut conn = setup_test_db();
    let squad = get_or_create_room(&conn, "oct-squad").unwrap();
    let user = get_or_create_user(&conn, "token-oct", &squad.slug).unwrap();

    // 1. Pre-October workout (Sept 30, 2026) -> Advances Caribou, does NOT advance Lazy Tri
    let pre_oct_req = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("Late September Run".to_string()),
        distance_val: Some(5.0),
        total_metric: Some(5.0),
        created_at: Some("2026-09-30T23:59:59Z".to_string()),
        ..Default::default()
    };
    log_single_activity(&mut conn, &user, &squad.slug, &pre_oct_req).unwrap();

    let (active_goals1, _) = get_goals_for_room(&conn, &squad.slug, Some("token-oct")).unwrap();
    let caribou1 = active_goals1
        .iter()
        .find(|g| g.theme_key == "caribou")
        .unwrap();
    let ironman1 = active_goals1
        .iter()
        .find(|g| g.theme_key == "ironman")
        .unwrap();
    assert_eq!(
        caribou1.current_value, 5.0,
        "Caribou receives pre-October workout"
    );
    assert_eq!(
        ironman1.current_value, 0.0,
        "Lazy Tri rejects pre-October workout"
    );
    assert_eq!(
        ironman1.composite_progress.as_ref().unwrap().run_current,
        0.0
    );

    // 2. Mid-October workout (Oct 15, 2026) -> Advances BOTH Caribou and Lazy Tri
    let oct_req = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("October Bike Ride".to_string()),
        distance_val: Some(25.0),
        total_metric: Some(25.0),
        created_at: Some("2026-10-15T12:00:00Z".to_string()),
        ..Default::default()
    };
    log_single_activity(&mut conn, &user, &squad.slug, &oct_req).unwrap();

    let (active_goals2, _) = get_goals_for_room(&conn, &squad.slug, Some("token-oct")).unwrap();
    let caribou2 = active_goals2
        .iter()
        .find(|g| g.theme_key == "caribou")
        .unwrap();
    let ironman2 = active_goals2
        .iter()
        .find(|g| g.theme_key == "ironman")
        .unwrap();
    assert_eq!(caribou2.current_value, 30.0, "Caribou has 5 + 25");
    assert_eq!(
        ironman2.current_value, 25.0,
        "Lazy Tri receives October bike ride"
    );
    assert_eq!(
        ironman2.composite_progress.as_ref().unwrap().bike_current,
        25.0
    );

    // 3. Post-October workout (Nov 1, 2026) -> Advances Caribou, does NOT advance Lazy Tri
    let post_oct_req = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("November Marathon Training".to_string()),
        distance_val: Some(10.0),
        total_metric: Some(10.0),
        created_at: Some("2026-11-01T00:00:00Z".to_string()),
        ..Default::default()
    };
    log_single_activity(&mut conn, &user, &squad.slug, &post_oct_req).unwrap();

    let (active_goals3, _) = get_goals_for_room(&conn, &squad.slug, Some("token-oct")).unwrap();
    let caribou3 = active_goals3
        .iter()
        .find(|g| g.theme_key == "caribou")
        .unwrap();
    let ironman3 = active_goals3
        .iter()
        .find(|g| g.theme_key == "ironman")
        .unwrap();
    assert_eq!(caribou3.current_value, 40.0, "Caribou has 5 + 25 + 10");
    assert_eq!(
        ironman3.current_value, 25.0,
        "Lazy Tri does not accept post-October workout"
    );
    assert_eq!(
        ironman3.composite_progress.as_ref().unwrap().bike_current,
        25.0
    );
    assert_eq!(
        ironman3.composite_progress.as_ref().unwrap().run_current,
        0.0
    );
}

#[test]
fn test_lazy_tri_individual_squad_progress() {
    let mut conn = setup_test_db();
    let squad = get_or_create_room(&conn, "tri-team-squad").unwrap();
    let alice = get_or_create_user(&conn, "alice-token", &squad.slug).unwrap();
    let bob = get_or_create_user(&conn, "bob-token", &squad.slug).unwrap();

    // Alice logs 10 mi run and 50 mi bike in October
    let alice_run = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("Alice Trail Run".to_string()),
        distance_val: Some(10.0),
        total_metric: Some(10.0),
        created_at: Some("2026-10-05T08:00:00Z".to_string()),
        ..Default::default()
    };
    log_single_activity(&mut conn, &alice, &squad.slug, &alice_run).unwrap();

    let alice_bike = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("Alice Road Cycle".to_string()),
        distance_val: Some(50.0),
        total_metric: Some(50.0),
        created_at: Some("2026-10-07T10:00:00Z".to_string()),
        ..Default::default()
    };
    log_single_activity(&mut conn, &alice, &squad.slug, &alice_bike).unwrap();

    // Bob logs 20 mi bike and 1.0 mi swim in October
    let bob_bike = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("Bob Gravel Bike".to_string()),
        distance_val: Some(20.0),
        total_metric: Some(20.0),
        created_at: Some("2026-10-06T09:00:00Z".to_string()),
        ..Default::default()
    };
    log_single_activity(&mut conn, &bob, &squad.slug, &bob_bike).unwrap();

    let bob_swim = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("Bob Lap Swim".to_string()),
        distance_val: Some(1.0),
        total_metric: Some(1.0),
        created_at: Some("2026-10-08T07:30:00Z".to_string()),
        ..Default::default()
    };
    log_single_activity(&mut conn, &bob, &squad.slug, &bob_swim).unwrap();

    // 1. Check Alice's perspective
    let (alice_active, _) = get_goals_for_room(&conn, &squad.slug, Some("alice-token")).unwrap();
    let caribou = alice_active
        .iter()
        .find(|g| g.theme_key == "caribou")
        .unwrap();
    assert_eq!(
        caribou.current_value, 81.0,
        "Caribou Migration receives total squad distance: 10 + 50 + 20 + 1"
    );

    let alice_tri = alice_active
        .iter()
        .find(|g| g.theme_key == "ironman")
        .unwrap();
    assert_eq!(
        alice_tri.current_value, 60.0,
        "Alice's Lazy Tri only counts Alice's 10 + 50"
    );
    let alice_comp = alice_tri.composite_progress.as_ref().unwrap();
    assert_eq!(alice_comp.run_current, 10.0);
    assert_eq!(alice_comp.bike_current, 50.0);
    assert_eq!(alice_comp.swim_current, 0.0);
    assert!(!alice_comp.is_completed);

    // Teammates list should contain both Alice and Bob
    assert_eq!(alice_comp.members.len(), 2);
    let m_alice = alice_comp
        .members
        .iter()
        .find(|m| m.user_token == "alice-token")
        .unwrap();
    assert_eq!(m_alice.total_current, 60.0);
    assert!(!m_alice.is_completed);
    let m_bob = alice_comp
        .members
        .iter()
        .find(|m| m.user_token == "bob-token")
        .unwrap();
    assert_eq!(m_bob.total_current, 21.0);
    assert!(!m_bob.is_completed);

    // 2. Check Bob's perspective
    let (bob_active, _) = get_goals_for_room(&conn, &squad.slug, Some("bob-token")).unwrap();
    let bob_tri = bob_active
        .iter()
        .find(|g| g.theme_key == "ironman")
        .unwrap();
    assert_eq!(
        bob_tri.current_value, 21.0,
        "Bob's Lazy Tri only counts Bob's 20 + 1"
    );
    let bob_comp = bob_tri.composite_progress.as_ref().unwrap();
    assert_eq!(bob_comp.run_current, 0.0);
    assert_eq!(bob_comp.bike_current, 20.0);
    assert_eq!(bob_comp.swim_current, 1.0);
    assert!(!bob_comp.is_completed);

    // 3. Complete Alice's Lazy Tri (needs 2.4 swim, 62 bike, 16.2 run)
    let alice_swim_fin = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("Alice Pool Swim".to_string()),
        distance_val: Some(2.4),
        total_metric: Some(2.4),
        created_at: Some("2026-10-10T08:00:00Z".to_string()),
        ..Default::default()
    };
    log_single_activity(&mut conn, &alice, &squad.slug, &alice_swim_fin).unwrap();

    let alice_bike_fin = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("Alice Century Ride".to_string()),
        distance_val: Some(62.0),
        total_metric: Some(62.0),
        created_at: Some("2026-10-12T08:00:00Z".to_string()),
        ..Default::default()
    };
    log_single_activity(&mut conn, &alice, &squad.slug, &alice_bike_fin).unwrap();

    let alice_run_fin = LogActivityRequest {
        room_slug: Some(squad.slug.clone()),
        activity_type: "distance".to_string(),
        exercise_name: Some("Alice Half Marathon".to_string()),
        distance_val: Some(16.2),
        total_metric: Some(16.2),
        created_at: Some("2026-10-14T08:00:00Z".to_string()),
        ..Default::default()
    };
    log_single_activity(&mut conn, &alice, &squad.slug, &alice_run_fin).unwrap();

    // Alice should be completed
    let (alice_active2, alice_completed2) =
        get_goals_for_room(&conn, &squad.slug, Some("alice-token")).unwrap();
    let alice_tri2 = alice_active2
        .iter()
        .find(|g| g.theme_key == "ironman")
        .unwrap();
    assert_eq!(alice_tri2.current_value, 140.6);
    assert!(alice_tri2.composite_progress.as_ref().unwrap().is_completed);
    assert!(
        alice_completed2.iter().any(|g| g.theme_key == "ironman"),
        "Alice has conquered Lazy Tri trophy"
    );

    // Bob must STILL be active and incomplete!
    let (bob_active2, bob_completed2) =
        get_goals_for_room(&conn, &squad.slug, Some("bob-token")).unwrap();
    let bob_tri2 = bob_active2
        .iter()
        .find(|g| g.theme_key == "ironman")
        .unwrap();
    assert_eq!(bob_tri2.current_value, 21.0);
    assert!(!bob_tri2.composite_progress.as_ref().unwrap().is_completed);
    assert!(
        !bob_completed2.iter().any(|g| g.theme_key == "ironman"),
        "Bob does NOT have Lazy Tri trophy yet"
    );

    // But Bob sees Alice as completed in the teammates list!
    let bob_comp2 = bob_tri2.composite_progress.as_ref().unwrap();
    let bob_view_alice = bob_comp2
        .members
        .iter()
        .find(|m| m.user_token == "alice-token")
        .unwrap();
    assert!(bob_view_alice.is_completed, "Bob sees Alice completed");
    let bob_view_bob = bob_comp2
        .members
        .iter()
        .find(|m| m.user_token == "bob-token")
        .unwrap();
    assert!(
        !bob_view_bob.is_completed,
        "Bob sees himself still in progress"
    );
}
