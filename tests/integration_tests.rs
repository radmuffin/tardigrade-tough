use axum_test::TestServer;
use fly_common::ws::BroadcastHub;
use rusqlite::Connection;
use serde_json::json;
use std::sync::{Arc, Mutex};
use tardigrade_tough::db::*;
use tardigrade_tough::models::*;
use tardigrade_tough::routes::{create_routes, format_github_issue_body, AppState};
use tardigrade_tough::store::*;

fn setup_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("in-memory db failed");
    init_db(&mut conn).expect("init_db failed");
    conn
}

#[test]
fn test_db_initialization_and_default_seeds() {
    let conn = setup_test_db();

    // Verify init_db does not seed any hardcoded 'main' rooms
    let room_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM rooms", [], |r| r.get(0))
        .expect("count rooms");
    assert_eq!(room_count, 0, "No rooms should be hardcoded at init_db");

    let room = get_or_create_room(&conn, "pando-squad").expect("room");
    assert_eq!(room.slug, "pando-squad");

    let (active, completed) = get_goals_for_room(&conn, "pando-squad").expect("goals");
    assert_eq!(active.len(), 3);
    assert_eq!(completed.len(), 1);

    assert_eq!(active[0].theme_key, "pando");
    assert_eq!(active[0].category, "weight");
    assert_eq!(active[0].target_value, 13_200_000.0);

    assert_eq!(active[1].theme_key, "caribou");
    assert_eq!(active[1].category, "distance");
    assert_eq!(active[1].target_value, 3_000.0);

    assert_eq!(active[2].theme_key, "everest");
    assert_eq!(active[2].category, "elevation");
    assert_eq!(active[2].target_value, 29_031.0);

    assert_eq!(completed[0].theme_key, "whale");
    assert_eq!(completed[0].status, "completed");
}

#[test]
fn test_multi_room_isolation_and_cross_contamination() {
    let mut conn = setup_test_db();

    let room_a = get_or_create_room(&conn, "sally-squad").expect("sally squad");
    let room_b = get_or_create_room(&conn, "brandon-solo").expect("brandon solo");

    assert_eq!(room_a.slug, "sally-squad");
    assert_eq!(room_b.slug, "brandon-solo");

    let user_a = get_or_create_user(&conn, "token_sally", "sally-squad").expect("user_a");
    let _user_b = get_or_create_user(&conn, "token_brandon", "brandon-solo").expect("user_b");

    let act_a = log_single_activity(
        &mut conn,
        &user_a,
        "sally-squad",
        &LogActivityRequest {
            room_slug: Some("sally-squad".to_string()),
            user_nickname: Some("Sally".to_string()),
            user_avatar_color: None,
            user_avatar_emoji: None,
            activity_type: "weight".to_string(),
            exercise_name: Some("Leg Press".to_string()),
            sets: Some(5),
            reps: Some(10),
            weight_per_rep: Some(100.0),
            distance_val: None,
            elevation_val: None,
            total_metric: Some(5000.0),
            notes: None,
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
    )
    .expect("log user a");
    assert_eq!(act_a.total_metric, 5000.0);

    let (goals_a, _) = get_goals_for_room(&conn, "sally-squad").expect("goals a");
    let (goals_b, _) = get_goals_for_room(&conn, "brandon-solo").expect("goals b");

    assert_eq!(goals_a[0].current_value, 5000.0);
    assert_eq!(goals_b[0].current_value, 0.0);

    let lb_b = get_leaderboard(&conn, "brandon-solo").expect("lb b");
    assert_eq!(lb_b.len(), 0);

    let lb_a = get_leaderboard(&conn, "sally-squad").expect("lb a");
    assert_eq!(lb_a.len(), 1);
    assert_eq!(lb_a[0].nickname, "Sally");
    assert_eq!(lb_a[0].total_weight, 5000.0);
}

#[test]
fn test_all_three_goal_metrics_weight_distance_elevation() {
    let mut conn = setup_test_db();
    let user = get_or_create_user(&conn, "token_tri_athlete", "main").expect("user");

    log_single_activity(
        &mut conn,
        &user,
        "main",
        &LogActivityRequest {
            room_slug: Some("main".to_string()),
            user_nickname: None,
            user_avatar_color: None,
            user_avatar_emoji: None,
            activity_type: "weight".to_string(),
            exercise_name: Some("Squats".to_string()),
            sets: Some(1),
            reps: Some(10),
            weight_per_rep: Some(200.0),
            distance_val: None,
            elevation_val: None,
            total_metric: None,
            notes: None,
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
    )
    .expect("weight log");

    log_single_activity(
        &mut conn,
        &user,
        "main",
        &LogActivityRequest {
            room_slug: Some("main".to_string()),
            user_nickname: None,
            user_avatar_color: None,
            user_avatar_emoji: None,
            activity_type: "distance".to_string(),
            exercise_name: Some("Long Run".to_string()),
            sets: None,
            reps: None,
            weight_per_rep: None,
            distance_val: Some(15.5),
            elevation_val: None,
            total_metric: None,
            notes: None,
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
    )
    .expect("distance log");

    log_single_activity(
        &mut conn,
        &user,
        "main",
        &LogActivityRequest {
            room_slug: Some("main".to_string()),
            user_nickname: None,
            user_avatar_color: None,
            user_avatar_emoji: None,
            activity_type: "elevation".to_string(),
            exercise_name: Some("Stair Climber".to_string()),
            sets: None,
            reps: None,
            weight_per_rep: None,
            distance_val: None,
            elevation_val: Some(1250.0),
            total_metric: None,
            notes: None,
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
    )
    .expect("elevation log");

    let (active, _) = get_goals_for_room(&conn, "main").expect("goals");
    let pando = active.iter().find(|g| g.theme_key == "pando").unwrap();
    let caribou = active.iter().find(|g| g.theme_key == "caribou").unwrap();
    let everest = active.iter().find(|g| g.theme_key == "everest").unwrap();

    assert_eq!(pando.current_value, 2000.0);
    assert_eq!(caribou.current_value, 15.5);
    assert_eq!(everest.current_value, 1250.0);

    let lb = get_leaderboard(&conn, "main").expect("lb");
    assert_eq!(lb.len(), 1);
    assert_eq!(lb[0].total_weight, 2000.0);
    assert_eq!(lb[0].total_distance, 15.5);
    assert_eq!(lb[0].total_elevation, 1250.0);
    assert_eq!(lb[0].weight_percentage, 100.0);
    assert_eq!(lb[0].distance_percentage, 100.0);
    assert_eq!(lb[0].elevation_percentage, 100.0);
    assert!(lb[0].is_daily_mvp);
}

#[test]
fn test_batch_activity_import_transaction_atomicity() {
    let mut conn = setup_test_db();
    let user = get_or_create_user(&conn, "token_batch_user", "main").expect("user");

    let items = vec![
        LogActivityRequest {
            room_slug: Some("main".to_string()),
            user_nickname: Some("Samantha".to_string()),
            user_avatar_color: Some("#ec4899".to_string()),
            user_avatar_emoji: None,
            activity_type: "weight".to_string(),
            exercise_name: Some("Sheet Row 1".to_string()),
            sets: Some(1),
            reps: Some(10),
            weight_per_rep: Some(50.0),
            distance_val: None,
            elevation_val: None,
            total_metric: Some(500.0),
            notes: None,
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
        LogActivityRequest {
            room_slug: Some("main".to_string()),
            user_nickname: Some("Samantha".to_string()),
            user_avatar_color: Some("#ec4899".to_string()),
            user_avatar_emoji: None,
            activity_type: "weight".to_string(),
            exercise_name: Some("Sheet Row 2".to_string()),
            sets: Some(1),
            reps: Some(20),
            weight_per_rep: Some(100.0),
            distance_val: None,
            elevation_val: None,
            total_metric: Some(2000.0),
            notes: None,
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
    ];

    for item in &items {
        log_single_activity(&mut conn, &user, "main", item).expect("log item");
    }

    let lb = get_leaderboard(&conn, "main").expect("lb");
    let sam = lb.iter().find(|m| m.nickname == "Samantha").unwrap();
    assert_eq!(sam.total_weight, 2500.0);
    assert_eq!(sam.total_sets, 2);
}

#[test]
fn test_activity_deletion_and_rollback() {
    let mut conn = setup_test_db();
    let user = get_or_create_user(&conn, "token_del", "main").expect("user");

    let act = log_single_activity(
        &mut conn,
        &user,
        "main",
        &LogActivityRequest {
            room_slug: Some("main".to_string()),
            user_nickname: None,
            user_avatar_color: None,
            user_avatar_emoji: None,
            activity_type: "weight".to_string(),
            exercise_name: Some("Bench Press".to_string()),
            sets: Some(1),
            reps: Some(10),
            weight_per_rep: Some(225.0),
            distance_val: None,
            elevation_val: None,
            total_metric: Some(2250.0),
            notes: None,
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
    )
    .expect("log");

    let (active_1, _) = get_goals_for_room(&conn, "main").expect("goals");
    let val_1 = active_1
        .iter()
        .find(|g| g.theme_key == "pando")
        .unwrap()
        .current_value;

    let unauthorized_del = delete_activity(&mut conn, act.id, "wrong_token").expect("delete check");
    assert!(unauthorized_del.is_none());

    let authorized_del = delete_activity(&mut conn, act.id, "token_del").expect("delete ok");
    assert_eq!(authorized_del, Some(vec!["main".to_string()]));

    let (active_2, _) = get_goals_for_room(&conn, "main").expect("goals");
    let val_2 = active_2
        .iter()
        .find(|g| g.theme_key == "pando")
        .unwrap()
        .current_value;

    assert_eq!(val_2, val_1 - 2250.0);
}

#[test]
fn test_user_profile_customization_persistence() {
    let conn = setup_test_db();
    let user = get_or_create_user(&conn, "token_prof", "main").expect("user");

    assert_ne!(user.nickname, "IronBear");

    let updated = update_user_profile(
        &conn,
        "token_prof",
        &UpdateProfileRequest {
            nickname: Some("IronBear".to_string()),
            avatar_color: Some("#ec4899".to_string()),
            avatar_emoji: Some("🐻".to_string()),
            current_room_slug: None,
        },
    )
    .expect("update ok");
    assert_eq!(updated.nickname, "IronBear");
    assert_eq!(updated.avatar_color, "#ec4899");

    let refetched = get_or_create_user(&conn, "token_prof", "main").expect("refetch");
    assert_eq!(refetched.nickname, "IronBear");
    assert_eq!(refetched.avatar_color, "#ec4899");
}

#[test]
fn test_wishlist_submission_and_retrieval() {
    let conn = setup_test_db();
    let user = get_or_create_user(&conn, "token_submitter", "main").expect("user");

    // Case 1: Propose with explicit readable name
    let req = CreateGoalWishlistRequest {
        room_slug: "main".to_string(),
        title: "General Sherman Giant Sequoia".to_string(),
        category: "weight".to_string(),
        target_value: 2_700_000.0,
        unit: "lbs".to_string(),
        notes: Some("Largest known living single-stem tree".to_string()),
        user_nickname: Some("BigShermanFan".to_string()),
    };

    let item = create_goal_wishlist(&conn, "token_submitter", &req).expect("wishlist ok");
    assert_eq!(item.title, "General Sherman Giant Sequoia");
    assert_eq!(item.target_value, 2_700_000.0);
    assert_eq!(item.category, "weight");
    assert_eq!(item.notes, "Largest known living single-stem tree");
    assert_eq!(item.user_nickname, "BigShermanFan");
    assert_eq!(item.user_token, "token_submitter");

    // Verify issue body includes both the readable name and user UUID
    let issue_body = format_github_issue_body(&item);
    assert!(
        issue_body.contains("- **Proposed by**: BigShermanFan (`token_submitter`)"),
        "Issue body must include readable name and user UUID"
    );

    // Case 2: Propose with user_nickname None (fallback to DB users table)
    let req2 = CreateGoalWishlistRequest {
        room_slug: "main".to_string(),
        title: "Denali Traverse".to_string(),
        category: "elevation".to_string(),
        target_value: 20_310.0,
        unit: "ft".to_string(),
        notes: None,
        user_nickname: None,
    };

    let item2 = create_goal_wishlist(&conn, "token_submitter", &req2).expect("wishlist ok");
    assert_eq!(item2.user_nickname, user.nickname);
    assert_eq!(item2.user_token, "token_submitter");

    let issue_body2 = format_github_issue_body(&item2);
    assert!(
        issue_body2.contains(&format!(
            "- **Proposed by**: {} (`token_submitter`)",
            user.nickname
        )),
        "Issue body fallback must include user profile nickname and UUID"
    );

    // Case 3: Empty nickname fallback to UUID only
    let mut bare_item = item2.clone();
    bare_item.user_nickname = "".to_string();
    bare_item.user_token = "raw-uuid-123".to_string();
    let issue_body3 = format_github_issue_body(&bare_item);
    assert!(
        issue_body3.contains("- **Proposed by**: `raw-uuid-123`"),
        "Empty nickname fallback must display raw UUID in backticks"
    );

    // Verify retrieval
    let list = get_wishlists(&conn, "main").expect("wishlists");
    assert_eq!(list.len(), 2);
    assert_eq!(list[0].user_nickname, user.nickname);
    assert_eq!(list[1].user_nickname, "BigShermanFan");
}

#[test]
fn test_goal_completion_transition() {
    let mut conn = setup_test_db();
    let user = get_or_create_user(&conn, "token_mega_lifter", "solo_quest").expect("user");

    let act = log_single_activity(
        &mut conn,
        &user,
        "solo_quest",
        &LogActivityRequest {
            room_slug: Some("solo_quest".to_string()),
            user_nickname: None,
            user_avatar_color: None,
            user_avatar_emoji: None,
            activity_type: "distance".to_string(),
            exercise_name: Some("Trans-Continental Trek".to_string()),
            sets: None,
            reps: None,
            weight_per_rep: None,
            distance_val: Some(3050.0),
            elevation_val: None,
            total_metric: None,
            notes: None,
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
    )
    .expect("trek log");

    let (_, completed) = get_goals_for_room(&conn, "solo_quest").expect("goals");
    let finished_caribou = completed.iter().find(|g| g.theme_key == "caribou");
    assert!(finished_caribou.is_some());
    assert_eq!(finished_caribou.unwrap().status, "completed");
    assert_eq!(finished_caribou.unwrap().current_value, 3050.0);

    // Rollback: Deleting the activity must revert the goal back to 'active'
    let deleted_room =
        delete_activity(&mut conn, act.id, &user.user_token).expect("delete activity");
    assert_eq!(deleted_room, Some(vec!["solo_quest".to_string()]));

    let (active_after, completed_after) =
        get_goals_for_room(&conn, "solo_quest").expect("goals after delete");
    let caribou_active = active_after.iter().find(|g| g.theme_key == "caribou");
    assert!(
        caribou_active.is_some(),
        "Caribou must revert back to active goals"
    );
    assert_eq!(caribou_active.unwrap().status, "active");
    assert_eq!(caribou_active.unwrap().current_value, 0.0);
    assert!(!completed_after.iter().any(|g| g.theme_key == "caribou"));
}

// =========================================================================
// AXUM HTTP API ROUTE ENDPOINT INTEGRATION TESTS
// =========================================================================

#[tokio::test]
async fn test_api_info_endpoint() {
    let conn = setup_test_db();
    let db = Arc::new(Mutex::new(conn));
    let hub = Arc::new(BroadcastHub::new(256));
    let state = AppState::new(db, hub);
    let app = fly_common::server::FlyServer::builder()
        .with_app_info("Tardigrade Tough", "0.1.0")
        .nest("/api", create_routes(state))
        .build_router();
    let server = TestServer::new(app).unwrap();

    let res = server.get("/api/info").await;
    res.assert_status_ok();
    let json_val: serde_json::Value = res.json();
    assert_eq!(json_val["name"], "Tardigrade Tough");
    assert_eq!(json_val["version"], "0.1.0");
}

#[tokio::test]
async fn test_api_room_state_endpoint() {
    let conn = setup_test_db();
    let db = Arc::new(Mutex::new(conn));
    let hub = Arc::new(BroadcastHub::new(256));
    let state = AppState::new(db, hub);
    let app = create_routes(state);
    let server = TestServer::new(app).unwrap();

    let res = server
        .get("/room/main")
        .add_header("X-Device-Token", "test_device_token_xyz")
        .await;

    res.assert_status_ok();
    let json_val: serde_json::Value = res.json();
    assert_eq!(json_val["success"], true);
    assert_eq!(json_val["data"]["room"]["slug"], "main");
    assert!(json_val["data"]["active_goals"].as_array().unwrap().len() >= 3);
}

#[tokio::test]
async fn test_api_activity_logging_and_batch_endpoints() {
    let conn = setup_test_db();
    let db = Arc::new(Mutex::new(conn));
    let hub = Arc::new(BroadcastHub::new(256));
    let state = AppState::new(db, hub);
    let app = create_routes(state);
    let server = TestServer::new(app).unwrap();

    // 1. Single activity log
    let res = server
        .post("/activities")
        .add_header("X-Device-Token", "lifter_123")
        .json(&json!({
            "room_slug": "main",
            "activity_type": "weight",
            "exercise_name": "Overhead Press",
            "sets": 3,
            "reps": 10,
            "weight_per_rep": 95.0
        }))
        .await;

    assert_eq!(res.status_code(), axum::http::StatusCode::CREATED);
    let data: serde_json::Value = res.json();
    assert_eq!(data["success"], true);
    assert_eq!(data["data"]["total_metric"], 2850.0);

    // 2. Batch activities log
    let batch_res = server
        .post("/activities/batch")
        .add_header("X-Device-Token", "lifter_123")
        .json(&json!({
            "room_slug": "main",
            "user_nickname": "Sally",
            "user_avatar_color": "#f59e0b",
            "activities": [
                {
                    "activity_type": "weight",
                    "exercise_name": "Deadlift",
                    "sets": 1,
                    "reps": 5,
                    "weight_per_rep": 225.0,
                    "total_metric": 1125.0
                },
                {
                    "activity_type": "weight",
                    "exercise_name": "Squat",
                    "sets": 1,
                    "reps": 10,
                    "weight_per_rep": 135.0,
                    "total_metric": 1350.0
                }
            ]
        }))
        .await;

    assert_eq!(batch_res.status_code(), axum::http::StatusCode::CREATED);
    let batch_data: serde_json::Value = batch_res.json();
    assert_eq!(batch_data["success"], true);
    let items = batch_data["data"].as_array().unwrap();
    assert_eq!(items.len(), 2);
}

#[tokio::test]
async fn test_api_qr_generation_endpoint() {
    let conn = setup_test_db();
    let db = Arc::new(Mutex::new(conn));
    let hub = Arc::new(BroadcastHub::new(256));
    let state = AppState::new(db, hub);
    let app = create_routes(state);
    let server = TestServer::new(app).unwrap();

    let res = server.get("/qr?url=http://192.168.1.209:3000/r/main").await;
    res.assert_status_ok();
    assert_eq!(res.header("content-type"), "image/svg+xml");
    assert!(res.text().contains("<svg"));
}

#[tokio::test]
async fn test_api_cheer_endpoint() {
    let conn = setup_test_db();
    let db = Arc::new(Mutex::new(conn));
    let hub = Arc::new(BroadcastHub::new(256));
    let state = AppState::new(db, hub);
    let app = create_routes(state);
    let server = TestServer::new(app).unwrap();

    let res = server
        .post("/cheer")
        .add_header("X-Device-Token", "cheerer_123")
        .json(&json!({
            "room_slug": "main",
            "emoji": "🔥"
        }))
        .await;

    res.assert_status_ok();
    let json_val: serde_json::Value = res.json();
    assert_eq!(json_val["success"], true);
}

#[test]
fn test_pwa_configuration_and_assets() {
    use std::fs;
    use std::path::Path;

    // 1. Verify static/manifest.json
    let manifest_path = Path::new("static/manifest.json");
    assert!(manifest_path.exists(), "static/manifest.json must exist");
    let manifest_str = fs::read_to_string(manifest_path).expect("read manifest");
    let manifest: serde_json::Value =
        serde_json::from_str(&manifest_str).expect("manifest must be valid JSON");

    assert_eq!(
        manifest["display"], "standalone",
        "PWA display must be standalone"
    );
    assert_eq!(
        manifest["start_url"], "/",
        "PWA start_url must point to root"
    );
    assert!(
        manifest["name"].as_str().unwrap().contains("Tardigrade"),
        "PWA name should contain Tardigrade"
    );
    assert_eq!(
        manifest["short_name"], "Tardigrade",
        "PWA short_name should be Tardigrade"
    );

    let icons = manifest["icons"].as_array().expect("manifest icons array");
    assert!(
        icons.len() >= 3,
        "PWA manifest must define at least 3 icon variants"
    );

    let mut has_192 = false;
    let mut has_512 = false;
    let mut has_maskable = false;
    for icon in icons {
        let src = icon["src"].as_str().expect("icon src string");
        let sizes = icon["sizes"].as_str().unwrap_or("");
        let purpose = icon["purpose"].as_str().unwrap_or("");

        if sizes == "192x192" {
            has_192 = true;
        }
        if sizes == "512x512" && purpose != "maskable" {
            has_512 = true;
        }
        if purpose == "maskable" {
            has_maskable = true;
        }

        // Verify each icon file actually exists in static/
        let rel_path = format!("static{}", src);
        let icon_file = Path::new(&rel_path);
        assert!(
            icon_file.exists(),
            "Referenced icon file {} must exist",
            rel_path
        );
        let meta = fs::metadata(icon_file).expect("metadata");
        assert!(meta.len() > 0, "Icon file {} must not be empty", rel_path);
    }
    assert!(has_192, "PWA must include a 192x192 icon");
    assert!(has_512, "PWA must include a 512x512 icon");
    assert!(has_maskable, "PWA must include a maskable icon");

    // 2. Verify static/sw.js
    let sw_path = Path::new("static/sw.js");
    assert!(sw_path.exists(), "Service worker static/sw.js must exist");
    let sw_content = fs::read_to_string(sw_path).expect("read sw.js");
    assert!(
        sw_content.contains("addEventListener('install'"),
        "sw.js must have install handler"
    );
    assert!(
        sw_content.contains("addEventListener('activate'"),
        "sw.js must have activate handler"
    );
    assert!(
        sw_content.contains("addEventListener('fetch'"),
        "sw.js must have fetch handler"
    );
    assert!(
        sw_content.contains("/manifest.json"),
        "sw.js should precache manifest.json"
    );

    // 3. Verify static/index.html includes PWA tags
    let index_html = fs::read_to_string("static/index.html").expect("read index.html");
    assert!(
        index_html.contains(r#"rel="manifest""#),
        "index.html must link manifest.json"
    );
    assert!(
        index_html.contains(r#"name="theme-color""#),
        "index.html must include theme-color meta tag"
    );
    assert!(
        index_html.contains(r#"name="apple-mobile-web-app-capable""#),
        "index.html must include apple-mobile-web-app-capable meta tag"
    );
    assert!(
        index_html.contains(r#"rel="apple-touch-icon""#),
        "index.html must include apple-touch-icon link"
    );
}

#[test]
fn test_room_renaming_and_persistence() {
    let conn = setup_test_db();

    // 1. Initial room creation
    let room = create_room_for_user(&conn, "token_renamer", Some("Pando Squad")).expect("room");
    assert_eq!(room.name, "Pando Squad");

    // 2. Rename room
    let updated = update_room_name(&conn, &room.slug, "Iron Bears Squad").expect("update room");
    assert_eq!(updated.name, "Iron Bears Squad");
    assert_eq!(updated.slug, room.slug);

    // 3. Verify persistence
    let fetched = get_or_create_room(&conn, &room.slug).expect("fetch room");
    assert_eq!(fetched.name, "Iron Bears Squad");

    // 4. Verify invalid empty names are rejected
    assert!(update_room_name(&conn, &room.slug, "   ").is_err());
}

#[test]
fn test_custom_quest_category_proposal_promotion_and_activity_logging() {
    let mut conn = setup_test_db();
    let user = get_or_create_user(&conn, "token_custom_titan", "squad-custom").expect("user");

    // 1. Propose custom category quest (e.g. "pushups" / "reps")
    let wishlist_req = CreateGoalWishlistRequest {
        room_slug: "squad-custom".to_string(),
        title: "100k Pushup Challenge".to_string(),
        category: "pushups".to_string(),
        target_value: 100_000.0,
        unit: "reps".to_string(),
        notes: Some("Pushing the Earth down together".to_string()),
        user_nickname: None,
    };

    let item =
        create_goal_wishlist(&conn, &user.user_token, &wishlist_req).expect("create wishlist");
    assert_eq!(item.category, "pushups");
    assert_eq!(item.unit, "reps");
    assert_eq!(item.target_value, 100_000.0);

    // 2. Retrieve wishlist and verify custom category is intact
    let list = get_wishlists(&conn, "squad-custom").expect("wishlists");
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].category, "pushups");
    assert_eq!(list[0].unit, "reps");

    // 3. Promote wishlist proposal to active quest
    let goal_req = CreateGoalRequest {
        room_slug: Some("squad-custom".to_string()),
        title: item.title,
        category: item.category,
        target_value: item.target_value,
        unit: item.unit,
        theme_key: Some("custom".to_string()),
        description: Some(item.notes),
    };

    let goal = create_custom_goal(&conn, "squad-custom", &goal_req).expect("create custom goal");
    assert_eq!(goal.category, "pushups");
    assert_eq!(goal.current_value, 0.0);
    assert_eq!(goal.status, "active");

    // 4. Log an activity under this custom category (auto-routes to active pushups goal)
    let act = log_single_activity(
        &mut conn,
        &user,
        "squad-custom",
        &LogActivityRequest {
            room_slug: Some("squad-custom".to_string()),
            user_nickname: Some("CustomTitan".to_string()),
            user_avatar_color: None,
            user_avatar_emoji: None,
            activity_type: "pushups".to_string(),
            exercise_name: Some("Diamond Pushups".to_string()),
            sets: Some(5),
            reps: Some(20),
            weight_per_rep: None,
            distance_val: None,
            elevation_val: None,
            total_metric: None, // Falls back to sets * reps = 100
            notes: Some("Strict form".to_string()),
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
    )
    .expect("log pushups");

    assert_eq!(act.total_metric, 100.0);

    // 5. Verify goal was updated with 100 reps
    let (active_goals, _) = get_goals_for_room(&conn, "squad-custom").expect("goals");
    let pushup_goal = active_goals
        .iter()
        .find(|g| g.category == "pushups")
        .expect("pushup goal");
    assert_eq!(pushup_goal.current_value, 100.0);
}

#[tokio::test]
async fn test_new_visitor_gets_isolated_solo_room_not_main() {
    let conn = setup_test_db();
    let db = Arc::new(Mutex::new(conn));
    let hub = Arc::new(BroadcastHub::new(256));
    let state = AppState::new(db, hub);
    let app = create_routes(state);
    let mut server = TestServer::new(app).unwrap();

    // 1. New visitor visits main site (GET /room/current or GET /room)
    let res = server
        .get("/room/current")
        .add_header("X-Device-Token", "visitor_alice_new_1")
        .await;

    res.assert_status_ok();
    let json_val: serde_json::Value = res.json();
    assert_eq!(json_val["success"], true);

    let room_slug = json_val["data"]["room"]["slug"].as_str().unwrap();
    assert_ne!(
        room_slug, "main",
        "New visitors must NOT be automatically added to the 'main' group!"
    );
    assert!(
        room_slug.starts_with("solo-"),
        "New visitors should receive a private solo room slug"
    );
    assert_eq!(
        json_val["data"]["room"]["name"], "Solo Quest",
        "New solo room should be named Solo Quest"
    );
    assert_eq!(
        json_val["data"]["recent_activities"]
            .as_array()
            .unwrap()
            .len(),
        0,
        "New visitor solo room must have clean 0 activities"
    );

    // 2. Second visitor on a different device visits main site and gets their own distinct room
    server.clear_cookies();
    let res2 = server
        .get("/room/current")
        .add_header("X-Device-Token", "visitor_bob_new_2")
        .await;

    res2.assert_status_ok();
    let json_val2: serde_json::Value = res2.json();
    let bob_slug = json_val2["data"]["room"]["slug"].as_str().unwrap();
    assert_ne!(bob_slug, "main", "Second visitor must NOT be added to main");
    assert_ne!(
        bob_slug, room_slug,
        "Visitors must be isolated from each other"
    );

    // 3. Alice explicitly joining a squad retains that squad on subsequent /room/current calls
    server.clear_cookies();
    let res_join = server
        .get("/room/champions-crew")
        .add_header("X-Device-Token", "visitor_alice_new_1")
        .await;
    res_join.assert_status_ok();
    let json_join: serde_json::Value = res_join.json();
    assert_eq!(json_join["data"]["room"]["slug"], "champions-crew");

    // Returning to /room/current retains champions-crew
    let res_return = server
        .get("/room/current")
        .add_header("X-Device-Token", "visitor_alice_new_1")
        .await;
    res_return.assert_status_ok();
    let json_return: serde_json::Value = res_return.json();
    assert_eq!(json_return["data"]["room"]["slug"], "champions-crew");
}

#[tokio::test]
async fn test_squad_membership_view_everyone_leave_and_creator_remove_member() {
    let conn = setup_test_db();
    let db = Arc::new(Mutex::new(conn));
    let hub = Arc::new(BroadcastHub::new(256));
    let state = AppState::new(db, hub);
    let app = create_routes(state);
    let mut server = TestServer::new(app).unwrap();

    let alice_token = "alice_token_1";
    let bob_token = "bob_token_2";
    let charlie_token = "charlie_token_3";

    // 1. Alice creates / joins squad "alpha-squad"
    let res_alice = server
        .get("/room/alpha-squad")
        .add_header("X-Device-Token", alice_token)
        .await;
    res_alice.assert_status_ok();
    let data_alice: serde_json::Value = res_alice.json();
    assert_eq!(data_alice["data"]["room"]["slug"], "alpha-squad");

    // Alice updates her nickname
    server
        .post("/users/profile")
        .add_header("X-Device-Token", alice_token)
        .json(&serde_json::json!({ "nickname": "Alice The Founder" }))
        .await
        .assert_status_ok();

    // 2. Bob joins alpha-squad
    server.clear_cookies();
    let res_bob = server
        .get("/room/alpha-squad")
        .add_header("X-Device-Token", bob_token)
        .await;
    res_bob.assert_status_ok();
    server
        .post("/users/profile")
        .add_header("X-Device-Token", bob_token)
        .json(&serde_json::json!({ "nickname": "Bob The Lifter" }))
        .await
        .assert_status_ok();

    // 3. Charlie joins alpha-squad
    server.clear_cookies();
    let res_charlie = server
        .get("/room/alpha-squad")
        .add_header("X-Device-Token", charlie_token)
        .await;
    res_charlie.assert_status_ok();
    server
        .post("/users/profile")
        .add_header("X-Device-Token", charlie_token)
        .json(&serde_json::json!({ "nickname": "Charlie Runner" }))
        .await
        .assert_status_ok();

    // 4. Alice views room: should see everyone (3 members) with roles
    server.clear_cookies();
    let res_roster = server
        .get("/room/alpha-squad")
        .add_header("X-Device-Token", alice_token)
        .await;
    res_roster.assert_status_ok();
    let data_roster: serde_json::Value = res_roster.json();
    let members = data_roster["data"]["members"].as_array().unwrap();
    assert_eq!(members.len(), 3, "Squad roster must show all 3 members");

    // Alice is creator
    let alice_member = members
        .iter()
        .find(|m| m["user_token"] == alice_token)
        .unwrap();
    assert_eq!(alice_member["is_creator"], true);
    assert_eq!(alice_member["role"], "creator");

    // Bob & Charlie are members
    let bob_member = members
        .iter()
        .find(|m| m["user_token"] == bob_token)
        .unwrap();
    assert_eq!(bob_member["is_creator"], false);
    assert_eq!(bob_member["role"], "member");

    // 5. Bob (non-creator) attempts to remove Charlie -> Must be 403 FORBIDDEN
    server.clear_cookies();
    let res_unauth_remove = server
        .post(&format!(
            "/room/alpha-squad/members/{}/remove",
            charlie_token
        ))
        .add_header("X-Device-Token", bob_token)
        .await;
    assert_eq!(
        res_unauth_remove.status_code(),
        axum::http::StatusCode::FORBIDDEN
    );

    // 6. Alice (creator) removes Bob -> Must succeed 200 OK
    server.clear_cookies();
    let res_creator_remove = server
        .post(&format!("/room/alpha-squad/members/{}/remove", bob_token))
        .add_header("X-Device-Token", alice_token)
        .await;
    res_creator_remove.assert_status_ok();
    let remove_json: serde_json::Value = res_creator_remove.json();
    assert_eq!(remove_json["success"], true);
    assert_eq!(remove_json["data"]["removed_token"], bob_token);

    // Bob visits /room/current -> he is now in his private solo room, NOT alpha-squad!
    server.clear_cookies();
    let res_bob_solo = server
        .get("/room/current")
        .add_header("X-Device-Token", bob_token)
        .await;
    res_bob_solo.assert_status_ok();
    let bob_solo_data: serde_json::Value = res_bob_solo.json();
    let bob_curr_slug = bob_solo_data["data"]["room"]["slug"].as_str().unwrap();
    assert_ne!(bob_curr_slug, "alpha-squad");
    assert!(bob_curr_slug.starts_with("solo-"));

    // 7. Charlie voluntarily leaves alpha-squad
    server.clear_cookies();
    let res_charlie_leave = server
        .post("/room/alpha-squad/leave")
        .add_header("X-Device-Token", charlie_token)
        .await;
    res_charlie_leave.assert_status_ok();
    let leave_json: serde_json::Value = res_charlie_leave.json();
    assert_eq!(leave_json["success"], true);

    // Charlie visits /room/current -> he is now in his private solo room
    server.clear_cookies();
    let res_charlie_solo = server
        .get("/room/current")
        .add_header("X-Device-Token", charlie_token)
        .await;
    res_charlie_solo.assert_status_ok();
    let charlie_curr_slug = res_charlie_solo.json::<serde_json::Value>()["data"]["room"]["slug"]
        .as_str()
        .unwrap()
        .to_string();
    assert_ne!(charlie_curr_slug, "alpha-squad");
    assert!(charlie_curr_slug.starts_with("solo-"));

    // 8. Alice views alpha-squad -> only Alice remains
    server.clear_cookies();
    let res_final = server
        .get("/room/alpha-squad")
        .add_header("X-Device-Token", alice_token)
        .await;
    res_final.assert_status_ok();
    let final_members = res_final.json::<serde_json::Value>()["data"]["members"]
        .as_array()
        .unwrap()
        .clone();
    assert_eq!(final_members.len(), 1);
    assert_eq!(final_members[0]["user_token"], alice_token);
}

#[tokio::test]
async fn test_create_squad_defaults_to_username_and_lists_user_squads() {
    let conn = setup_test_db();
    let db = Arc::new(Mutex::new(conn));
    let hub = Arc::new(BroadcastHub::new(256));
    let state = AppState::new(db, hub);
    let app = create_routes(state);
    let server = TestServer::new(app).unwrap();

    let user_token = "hercules_token_99";

    // 1. Set nickname
    let res_prof = server
        .post("/users/profile")
        .add_header("X-Device-Token", user_token)
        .json(&json!({
            "nickname": "Hercules"
        }))
        .await;
    res_prof.assert_status_ok();

    // 2. Create squad with default name (empty/none)
    let res_create_1 = server
        .post("/room/create")
        .add_header("X-Device-Token", user_token)
        .json(&json!({}))
        .await;
    res_create_1.assert_status_ok();
    let create_1_json: serde_json::Value = res_create_1.json();
    assert_eq!(create_1_json["success"], true);
    assert_eq!(
        create_1_json["data"]["name"], "Hercules's Squad",
        "Created squad should default to <nickname>'s Squad"
    );
    let slug_1 = create_1_json["data"]["slug"].as_str().unwrap().to_string();
    assert!(slug_1.starts_with("hercules-s-squad-"));

    // 3. Create a second squad with explicit custom name
    let res_create_2 = server
        .post("/room/create")
        .add_header("X-Device-Token", user_token)
        .json(&json!({
            "name": "Olympian Lifters"
        }))
        .await;
    res_create_2.assert_status_ok();
    let create_2_json: serde_json::Value = res_create_2.json();
    assert_eq!(create_2_json["success"], true);
    assert_eq!(create_2_json["data"]["name"], "Olympian Lifters");
    let slug_2 = create_2_json["data"]["slug"].as_str().unwrap().to_string();

    // 4. Fetch room data and verify user_squads lists both squads
    let res_room = server
        .get(&format!("/room/{}", slug_2))
        .add_header("X-Device-Token", user_token)
        .await;
    res_room.assert_status_ok();
    let room_json: serde_json::Value = res_room.json();
    let user_squads = room_json["data"]["user_squads"].as_array().unwrap();
    assert_eq!(user_squads.len(), 2);
    assert!(user_squads
        .iter()
        .any(|s| s["slug"] == slug_1 && s["is_creator"] == true));
    assert!(user_squads
        .iter()
        .any(|s| s["slug"] == slug_2 && s["is_creator"] == true));

    // 5. Another user joins slug_1 and inspects their squads
    let guest_token = "guest_pegasus_77";
    let res_guest = server
        .get(&format!("/room/{}", slug_1))
        .add_header("X-Device-Token", guest_token)
        .await;
    res_guest.assert_status_ok();
    let guest_json: serde_json::Value = res_guest.json();
    let guest_squads = guest_json["data"]["user_squads"].as_array().unwrap();
    assert_eq!(guest_squads.len(), 1);
    assert_eq!(guest_squads[0]["slug"], slug_1);
    assert_eq!(guest_squads[0]["is_creator"], false);
    assert_eq!(guest_squads[0]["member_count"], 2);
}

#[tokio::test]
async fn test_avatar_emoji_customization_and_activity_propagation() {
    let conn = setup_test_db();
    let db = Arc::new(Mutex::new(conn));
    let hub = Arc::new(BroadcastHub::new(256));
    let state = AppState::new(db, hub);
    let app = create_routes(state);
    let server = TestServer::new(app).unwrap();
    let user_token = "token_emoji_gorilla_99";
    let room_slug = "squad-gorilla-power";

    // 1. Update user profile to choose emoji "🦍" and color "#14b8a6"
    let res_profile = server
        .post("/users/profile")
        .add_header("X-Device-Token", user_token)
        .json(&json!({
            "nickname": "Silverback",
            "avatar_color": "#14b8a6",
            "avatar_emoji": "🦍",
            "current_room_slug": room_slug
        }))
        .await;
    res_profile.assert_status_ok();
    let profile_json: serde_json::Value = res_profile.json();
    assert_eq!(profile_json["data"]["nickname"], "Silverback");
    assert_eq!(profile_json["data"]["avatar_color"], "#14b8a6");
    assert_eq!(profile_json["data"]["avatar_emoji"], "🦍");

    // 2. Log activity without explicit avatar_emoji (should auto-populate from profile)
    let res_act = server
        .post("/activities")
        .add_header("X-Device-Token", user_token)
        .json(&json!({
            "room_slug": room_slug,
            "activity_type": "weight",
            "exercise_name": "Heavy Deadlift",
            "sets": 3,
            "reps": 5,
            "weight_per_rep": 405.0
        }))
        .await;
    assert_eq!(res_act.status_code(), axum::http::StatusCode::CREATED);
    let act_json: serde_json::Value = res_act.json();
    assert_eq!(act_json["data"]["user_avatar_emoji"], "🦍");
    assert_eq!(act_json["data"]["user_avatar_color"], "#14b8a6");

    // 3. Fetch room data and check leaderboard and room_members
    let res_room = server
        .get(&format!("/room/{}", room_slug))
        .add_header("X-Device-Token", user_token)
        .await;
    res_room.assert_status_ok();
    let room_json: serde_json::Value = res_room.json();

    let members = room_json["data"]["members"].as_array().unwrap();
    let me = members
        .iter()
        .find(|m| m["user_token"] == user_token)
        .unwrap();
    assert_eq!(me["avatar_emoji"], "🦍");
    assert_eq!(me["avatar_color"], "#14b8a6");

    let lb = room_json["data"]["leaderboard"].as_array().unwrap();
    assert_eq!(lb[0]["avatar_emoji"], "🦍");
    assert_eq!(lb[0]["avatar_color"], "#14b8a6");
}

#[tokio::test]
async fn test_solo_activity_auto_forwards_to_user_squads_and_cascades_delete() {
    let conn = setup_test_db();
    let db = Arc::new(Mutex::new(conn));
    let hub = Arc::new(BroadcastHub::new(256));
    let state = AppState::new(db, hub);
    let app = create_routes(state);
    let server = TestServer::new(app).unwrap();

    let user_token = "solo_forward_user_tok";

    // 1. User visits /room/current and gets private solo room
    let res = server
        .get("/room/current")
        .add_header("X-Device-Token", user_token)
        .await;
    res.assert_status_ok();
    let solo_data: serde_json::Value = res.json();
    let solo_slug = solo_data["data"]["room"]["slug"]
        .as_str()
        .unwrap()
        .to_string();
    assert!(solo_slug.starts_with("solo-"));

    // 2. User creates a squad "Alpha Crew"
    let create_res = server
        .post("/room/create")
        .add_header("X-Device-Token", user_token)
        .json(&json!({ "name": "Alpha Crew" }))
        .await;
    create_res.assert_status_ok();
    let squad_data: serde_json::Value = create_res.json();
    let squad_slug = squad_data["data"]["slug"].as_str().unwrap().to_string();
    assert!(squad_slug.starts_with("alpha-crew"));

    // Verify initial squad goal (Pando Aspen Clone) has current_value = 0
    let squad_res_init = server
        .get(&format!("/room/{}", squad_slug))
        .add_header("X-Device-Token", user_token)
        .await;
    squad_res_init.assert_status_ok();
    let squad_init_json: serde_json::Value = squad_res_init.json();
    let pando_goal = squad_init_json["data"]["active_goals"]
        .as_array()
        .unwrap()
        .iter()
        .find(|g| g["theme_key"] == "pando")
        .unwrap();
    assert_eq!(pando_goal["current_value"], 0.0);

    // 3. User logs a single activity in their private solo room
    let log_res = server
        .post("/activities")
        .add_header("X-Device-Token", user_token)
        .json(&json!({
            "room_slug": solo_slug,
            "activity_type": "weight",
            "exercise_name": "Deadlift",
            "sets": 5,
            "reps": 5,
            "weight_per_rep": 300.0,
            "total_metric": 7500.0
        }))
        .await;
    assert_eq!(log_res.status_code(), axum::http::StatusCode::CREATED);
    let log_json: serde_json::Value = log_res.json();
    let solo_act_id = log_json["data"]["id"].as_i64().unwrap();

    // Check solo room: goal is updated, activity is present
    let solo_check = server
        .get(&format!("/room/{}", solo_slug))
        .add_header("X-Device-Token", user_token)
        .await;
    let solo_check_json: serde_json::Value = solo_check.json();
    let solo_pando = solo_check_json["data"]["active_goals"]
        .as_array()
        .unwrap()
        .iter()
        .find(|g| g["theme_key"] == "pando")
        .unwrap();
    assert_eq!(solo_pando["current_value"], 7500.0);
    assert_eq!(
        solo_check_json["data"]["recent_activities"]
            .as_array()
            .unwrap()
            .len(),
        1
    );

    // 4. Check squad room: activity was automatically forwarded!
    // Squad goal is incremented, activity is in feed, and user has stats on leaderboard
    let squad_check = server
        .get(&format!("/room/{}", squad_slug))
        .add_header("X-Device-Token", user_token)
        .await;
    let squad_check_json: serde_json::Value = squad_check.json();
    let squad_pando = squad_check_json["data"]["active_goals"]
        .as_array()
        .unwrap()
        .iter()
        .find(|g| g["theme_key"] == "pando")
        .unwrap();
    assert_eq!(
        squad_pando["current_value"], 7500.0,
        "Squad goal must auto-increment from solo workout"
    );

    let squad_acts = squad_check_json["data"]["recent_activities"]
        .as_array()
        .unwrap();
    assert_eq!(squad_acts.len(), 1, "Squad must have 1 forwarded activity");
    assert_eq!(squad_acts[0]["exercise_name"], "Deadlift");
    assert_eq!(squad_acts[0]["parent_activity_id"], solo_act_id);

    let squad_lb = squad_check_json["data"]["leaderboard"].as_array().unwrap();
    assert_eq!(squad_lb.len(), 1);
    assert_eq!(squad_lb[0]["total_weight"], 7500.0);
    assert_eq!(squad_lb[0]["total_sets"], 5);

    // 5. Test batch logging in solo room auto-forwards to squad
    let batch_res = server
        .post("/activities/batch")
        .add_header("X-Device-Token", user_token)
        .json(&json!({
            "room_slug": solo_slug,
            "activities": [
                {
                    "activity_type": "weight",
                    "exercise_name": "Bench Press",
                    "sets": 3,
                    "reps": 10,
                    "weight_per_rep": 150.0,
                    "total_metric": 4500.0
                },
                {
                    "activity_type": "distance",
                    "exercise_name": "Treadmill Run",
                    "sets": 1,
                    "reps": 1,
                    "distance_val": 5.0,
                    "total_metric": 5.0
                }
            ]
        }))
        .await;
    assert_eq!(batch_res.status_code(), axum::http::StatusCode::CREATED);

    // Check squad room after batch: weight goal is 7500 + 4500 = 12000, distance goal (caribou) is 5.0
    let squad_check_batch = server
        .get(&format!("/room/{}", squad_slug))
        .add_header("X-Device-Token", user_token)
        .await;
    let squad_batch_json: serde_json::Value = squad_check_batch.json();
    let squad_pando_batch = squad_batch_json["data"]["active_goals"]
        .as_array()
        .unwrap()
        .iter()
        .find(|g| g["theme_key"] == "pando")
        .unwrap();
    assert_eq!(squad_pando_batch["current_value"], 12000.0);

    let squad_caribou_batch = squad_batch_json["data"]["active_goals"]
        .as_array()
        .unwrap()
        .iter()
        .find(|g| g["theme_key"] == "caribou")
        .unwrap();
    assert_eq!(squad_caribou_batch["current_value"], 5.0);

    // 6. Test cascading delete: Delete the initial deadlift from solo room
    let del_res = server
        .delete(&format!("/activities/{}", solo_act_id))
        .add_header("X-Device-Token", user_token)
        .await;
    del_res.assert_status_ok();

    // Solo room goal decremented from 12000 to 4500
    let solo_after_del = server
        .get(&format!("/room/{}", solo_slug))
        .add_header("X-Device-Token", user_token)
        .await;
    let solo_del_json: serde_json::Value = solo_after_del.json();
    let solo_pando_del = solo_del_json["data"]["active_goals"]
        .as_array()
        .unwrap()
        .iter()
        .find(|g| g["theme_key"] == "pando")
        .unwrap();
    assert_eq!(solo_pando_del["current_value"], 4500.0);

    // Squad room goal also decremented from 12000 to 4500, and child activity deleted!
    let squad_after_del = server
        .get(&format!("/room/{}", squad_slug))
        .add_header("X-Device-Token", user_token)
        .await;
    let squad_del_json: serde_json::Value = squad_after_del.json();
    let squad_pando_del = squad_del_json["data"]["active_goals"]
        .as_array()
        .unwrap()
        .iter()
        .find(|g| g["theme_key"] == "pando")
        .unwrap();
    assert_eq!(
        squad_pando_del["current_value"], 4500.0,
        "Squad goal must roll back when solo parent activity is deleted"
    );

    let remaining_squad_acts = squad_del_json["data"]["recent_activities"]
        .as_array()
        .unwrap();
    assert_eq!(
        remaining_squad_acts.len(),
        2,
        "Child forwarded activity should be removed from squad"
    );
    assert!(remaining_squad_acts
        .iter()
        .all(|a| a["exercise_name"] != "Deadlift"));
}

#[test]
fn test_init_db_migrates_existing_activities_table_without_parent_activity_id() {
    let mut conn = Connection::open_in_memory().expect("open");
    // Create an older schema table activities WITHOUT parent_activity_id
    conn.execute_batch(
        r#"
        CREATE TABLE activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_slug TEXT NOT NULL,
            user_token TEXT NOT NULL,
            user_nickname TEXT NOT NULL,
            user_avatar_color TEXT NOT NULL,
            goal_id INTEGER,
            activity_type TEXT NOT NULL,
            exercise_name TEXT NOT NULL,
            sets INTEGER DEFAULT 1,
            reps INTEGER DEFAULT 1,
            weight_per_rep REAL DEFAULT 0,
            distance_val REAL DEFAULT 0,
            elevation_val REAL DEFAULT 0,
            total_metric REAL NOT NULL,
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );
        "#,
    )
    .expect("seed old activities");

    // init_db must migrate the table and not error on missing column
    init_db(&mut conn).expect("init_db on pre-existing table should succeed");

    // Ensure parent_activity_id column exists and can be selected
    let _stmt = conn
        .prepare("SELECT parent_activity_id FROM activities")
        .expect("parent_activity_id column must exist after migration");
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM activities", [], |r| r.get(0))
        .expect("count");
    assert_eq!(count, 0);
}

#[test]
fn test_personal_record_detection_and_query() {
    let mut conn = setup_test_db();
    let user = get_or_create_user(&conn, "token_pr_tester", "test-squad").expect("user");

    // 1. First bench press @ 225 lbs -> is a PR!
    let act1 = log_single_activity(
        &mut conn,
        &user,
        "test-squad",
        &LogActivityRequest {
            room_slug: Some("test-squad".to_string()),
            user_nickname: Some("Tester".to_string()),
            user_avatar_color: None,
            user_avatar_emoji: None,
            activity_type: "weight".to_string(),
            exercise_name: Some("Bench Press".to_string()),
            sets: Some(3),
            reps: Some(5),
            weight_per_rep: Some(225.0),
            distance_val: None,
            elevation_val: None,
            total_metric: None,
            notes: None,
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
    )
    .expect("act1");
    assert!(act1.is_pr, "First bench press should be marked PR");

    // 2. Second bench press @ 205 lbs -> NOT a PR!
    let act2 = log_single_activity(
        &mut conn,
        &user,
        "test-squad",
        &LogActivityRequest {
            room_slug: Some("test-squad".to_string()),
            user_nickname: Some("Tester".to_string()),
            user_avatar_color: None,
            user_avatar_emoji: None,
            activity_type: "weight".to_string(),
            exercise_name: Some("Bench Press".to_string()),
            sets: Some(3),
            reps: Some(5),
            weight_per_rep: Some(205.0),
            distance_val: None,
            elevation_val: None,
            total_metric: None,
            notes: None,
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
    )
    .expect("act2");
    assert!(!act2.is_pr, "Lower weight should not be a PR");

    // 3. Third bench press @ 245 lbs -> New PR!
    let act3 = log_single_activity(
        &mut conn,
        &user,
        "test-squad",
        &LogActivityRequest {
            room_slug: Some("test-squad".to_string()),
            user_nickname: Some("Tester".to_string()),
            user_avatar_color: None,
            user_avatar_emoji: None,
            activity_type: "weight".to_string(),
            exercise_name: Some("Bench Press".to_string()),
            sets: Some(1),
            reps: Some(1),
            weight_per_rep: Some(245.0),
            distance_val: None,
            elevation_val: None,
            total_metric: None,
            notes: None,
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
    )
    .expect("act3");
    assert!(act3.is_pr, "Heavier weight should be marked PR");

    // 4. Query personal records
    let prs = get_user_personal_records(&conn, "token_pr_tester").expect("get prs");
    assert_eq!(prs.len(), 1);
    assert_eq!(prs[0].exercise_name, "Bench Press");
    assert_eq!(prs[0].max_weight, 245.0);
}

#[test]
fn test_user_streak_and_tardigrade_state() {
    let mut conn = setup_test_db();
    let user = get_or_create_user(&conn, "token_streak_tester", "streak-squad").expect("user");

    // Initially no activities -> streak 0, cryptobiosis
    let (streak, state) = calculate_user_streak(&conn, "token_streak_tester");
    assert_eq!(streak, 0);
    assert_eq!(state, "cryptobiosis");

    // Log activity today
    let today = chrono::Utc::now().to_rfc3339();
    log_single_activity(
        &mut conn,
        &user,
        "streak-squad",
        &LogActivityRequest {
            room_slug: Some("streak-squad".to_string()),
            user_nickname: Some("StreakGuy".to_string()),
            user_avatar_color: None,
            user_avatar_emoji: None,
            activity_type: "weight".to_string(),
            exercise_name: Some("Squat".to_string()),
            sets: Some(3),
            reps: Some(5),
            weight_per_rep: Some(315.0),
            distance_val: None,
            elevation_val: None,
            total_metric: None,
            notes: None,
            goal_id: None,
            created_at: Some(today),
            parent_activity_id: None,
            is_pr: None,
        },
    )
    .expect("log today");

    let (streak_after, state_after) = calculate_user_streak(&conn, "token_streak_tester");
    assert_eq!(streak_after, 1);
    assert_eq!(state_after, "hydrated");
}

#[tokio::test]
async fn test_create_custom_quest_with_theme_palette() {
    let conn = setup_test_db();
    let db = Arc::new(Mutex::new(conn));
    let hub = Arc::new(BroadcastHub::new(256));
    let state = AppState::new(db, hub);
    let app = create_routes(state);
    let server = TestServer::new(app).unwrap();

    let user_token = "token_quest_creator";

    // 1. Create room
    let create_res = server
        .post("/room/create")
        .add_header("X-Device-Token", user_token)
        .json(&serde_json::json!({
            "name": "Magma Squad"
        }))
        .await;
    assert_eq!(create_res.status_code(), axum::http::StatusCode::OK);
    let create_json: serde_json::Value = create_res.json();
    let room_slug = create_json["data"]["slug"].as_str().unwrap();

    // 2. Create custom quest with 'volcano' theme
    let goal_res = server
        .post("/goals")
        .add_header("X-Device-Token", user_token)
        .json(&serde_json::json!({
            "room_slug": room_slug,
            "title": "Mount Doom",
            "category": "weight",
            "target_value": 75000.0,
            "unit": "lbs",
            "theme_key": "volcano",
            "description": "Lifting into the fires of Mount Doom"
        }))
        .await;
    assert_eq!(goal_res.status_code(), axum::http::StatusCode::CREATED);
    let goal_json: serde_json::Value = goal_res.json();
    assert_eq!(goal_json["data"]["theme_key"], "volcano");
    assert_eq!(goal_json["data"]["title"], "Mount Doom");
    let goal_id = goal_json["data"]["id"].as_i64().unwrap();

    // 3. Verify it shows up in GET /room/:slug active_goals
    let room_res = server
        .get(&format!("/room/{}", room_slug))
        .add_header("X-Device-Token", user_token)
        .await;
    assert_eq!(room_res.status_code(), axum::http::StatusCode::OK);
    let room_json: serde_json::Value = room_res.json();
    let active_goals = room_json["data"]["active_goals"].as_array().unwrap();
    let found = active_goals
        .iter()
        .find(|g| g["id"] == goal_id)
        .expect("found custom volcano goal");
    assert_eq!(found["theme_key"], "volcano");
    assert_eq!(found["target_value"], 75000.0);
}

#[tokio::test]
async fn test_data_store_trait_abstraction() {
    let conn = setup_test_db();
    let db = Arc::new(Mutex::new(conn));
    let store: Arc<dyn DataStore> = Arc::new(SqliteStore::new(db.clone()));

    // 1. Test RoomStore trait method
    let room = store
        .get_or_create_room("abstract-squad")
        .expect("get_or_create_room");
    assert_eq!(room.slug, "abstract-squad");

    // 2. Test UserStore trait method
    let user = store
        .get_or_create_user("token_abstract_user", &room.slug)
        .expect("get_or_create_user");
    assert_eq!(user.user_token, "token_abstract_user");

    // 3. Test GoalStore trait method
    let goal = store
        .create_custom_goal(
            &room.slug,
            &CreateGoalRequest {
                room_slug: Some(room.slug.clone()),
                title: "Titan Pullups".to_string(),
                category: "weight".to_string(),
                target_value: 10000.0,
                unit: "lbs".to_string(),
                theme_key: Some("canopy".to_string()),
                description: Some("Custom canopy pullup quest".to_string()),
            },
        )
        .expect("create_custom_goal");
    assert_eq!(goal.title, "Titan Pullups");
    assert_eq!(goal.theme_key, "canopy");

    // 4. Test ActivityStore trait method
    let activity = store
        .log_single_activity(
            &user,
            &room.slug,
            &LogActivityRequest {
                room_slug: Some(room.slug.clone()),
                user_nickname: Some(user.nickname.clone()),
                user_avatar_color: None,
                user_avatar_emoji: None,
                activity_type: "weight".to_string(),
                exercise_name: Some("Pullup".to_string()),
                sets: Some(5),
                reps: Some(10),
                weight_per_rep: Some(200.0),
                distance_val: None,
                elevation_val: None,
                total_metric: None,
                notes: None,
                goal_id: Some(goal.id),
                created_at: None,
                parent_activity_id: None,
                is_pr: None,
            },
        )
        .expect("log_single_activity");
    assert_eq!(activity.total_metric, 10000.0);
    assert!(activity.is_pr);

    // 5. Verify goal completion through GoalStore
    let (_active, completed) = store.get_goals_for_room(&room.slug).expect("get_goals");
    let completed_titan = completed
        .iter()
        .find(|g| g.id == goal.id)
        .expect("Titan Pullups should be completed");
    assert_eq!(completed_titan.current_value, 10000.0);
    assert_eq!(completed_titan.status, "completed");
}

#[tokio::test]
async fn test_ability_goal_creation_checkoff_pr_and_rollback() {
    let conn = setup_test_db();
    let db = Arc::new(Mutex::new(conn));
    let hub = Arc::new(BroadcastHub::new(100));
    let state = AppState::new(db, hub);
    let app = create_routes(state);
    let server = TestServer::new(app).unwrap();

    let user_token = "token_ability_ninja";

    // 1. Create an Ability Goal (One-Off Feat: Muscle Up)
    let create_res = server
        .post("/goals")
        .add_header("x-user-token", user_token)
        .json(&json!({
            "title": "Strict Muscle Up",
            "category": "ability",
            "target_value": 1.0,
            "unit": "feat",
            "theme_key": "feat",
            "description": "Strict bar muscle up with no kip."
        }))
        .await;
    create_res.assert_status(axum::http::StatusCode::CREATED);
    let goal_json: serde_json::Value = create_res.json();
    let goal_id = goal_json["data"]["id"].as_i64().unwrap();
    assert_eq!(goal_json["data"]["category"], "ability");
    assert_eq!(goal_json["data"]["status"], "active");
    assert_eq!(goal_json["data"]["target_value"], 1.0);
    assert_eq!(goal_json["data"]["current_value"], 0.0);

    // 2. Verify it shows in active_goals
    let room_res = server
        .get("/room/current")
        .add_header("x-user-token", user_token)
        .await;
    room_res.assert_status_ok();
    let room_data: serde_json::Value = room_res.json();
    let active_goals = room_data["data"]["active_goals"].as_array().unwrap();
    assert!(active_goals.iter().any(|g| g["id"] == goal_id));

    // 3. Check off the goal via /goals/:id/checkoff
    let checkoff_res = server
        .post(&format!("/goals/{}/checkoff", goal_id))
        .add_header("x-user-token", user_token)
        .json(&json!({
            "notes": "First clean ring muscle up!"
        }))
        .await;
    checkoff_res.assert_status_ok();
    let checkoff_json: serde_json::Value = checkoff_res.json();
    assert_eq!(checkoff_json["data"]["goal"]["status"], "completed");
    assert_eq!(checkoff_json["data"]["goal"]["current_value"], 1.0);
    assert_eq!(
        checkoff_json["data"]["activity"]["activity_type"],
        "ability"
    );
    assert_eq!(
        checkoff_json["data"]["activity"]["exercise_name"],
        "Strict Muscle Up"
    );
    assert_eq!(
        checkoff_json["data"]["activity"]["notes"],
        "First clean ring muscle up!"
    );
    assert_eq!(checkoff_json["data"]["activity"]["is_pr"], true);
    let activity_id = checkoff_json["data"]["activity"]["id"].as_i64().unwrap();

    // 4. Verify the goal is now in completed_goals
    let room_after = server
        .get("/room/current")
        .add_header("x-user-token", user_token)
        .await;
    let room_after_data: serde_json::Value = room_after.json();
    let completed_goals = room_after_data["data"]["completed_goals"]
        .as_array()
        .unwrap();
    assert!(completed_goals.iter().any(|g| g["id"] == goal_id));

    // 5. Attempting to check off an already-completed goal fails with 400
    let second_checkoff = server
        .post(&format!("/goals/{}/checkoff", goal_id))
        .add_header("x-user-token", user_token)
        .json(&json!({}))
        .await;
    second_checkoff.assert_status(axum::http::StatusCode::BAD_REQUEST);

    // 6. Delete the activity to test transactional rollback
    let del_res = server
        .delete(&format!("/activities/{}", activity_id))
        .add_header("x-user-token", user_token)
        .await;
    del_res.assert_status_ok();

    // Verify goal reverted to active and current_value 0.0
    let room_rollback = server
        .get("/room/current")
        .add_header("x-user-token", user_token)
        .await;
    let rollback_data: serde_json::Value = room_rollback.json();
    let rollback_active = rollback_data["data"]["active_goals"].as_array().unwrap();
    let reverted_goal = rollback_active
        .iter()
        .find(|g| g["id"] == goal_id)
        .expect("Goal should be active again");
    assert_eq!(reverted_goal["status"], "active");
    assert_eq!(reverted_goal["current_value"], 0.0);
}

#[tokio::test]
async fn test_solo_ability_checkoff_auto_forwards_to_squads() {
    let conn = setup_test_db();
    let db = Arc::new(Mutex::new(conn));
    let hub = Arc::new(BroadcastHub::new(100));
    let state = AppState::new(db, hub);
    let app = create_routes(state);
    let server = TestServer::new(app).unwrap();

    let user_token = "token_solo_gymnast";

    // 1. Create a squad
    let squad_res = server
        .post("/room/create")
        .add_header("x-user-token", user_token)
        .json(&json!({
            "name": "Gymnast Squad"
        }))
        .await;
    squad_res.assert_status_ok();
    let squad_json: serde_json::Value = squad_res.json();
    let squad_slug = squad_json["data"]["slug"].as_str().unwrap().to_string();

    // 2. In solo room, create an ability goal "Backflip"
    let solo_room = format!("solo-{}", user_token);
    let goal_res = server
        .post("/goals")
        .add_header("x-user-token", user_token)
        .json(&json!({
            "room_slug": solo_room,
            "title": "Backflip",
            "category": "ability",
            "target_value": 1.0,
            "unit": "feat",
            "theme_key": "feat"
        }))
        .await;
    goal_res.assert_status(axum::http::StatusCode::CREATED);
    let goal_json: serde_json::Value = goal_res.json();
    let goal_id = goal_json["data"]["id"].as_i64().unwrap();

    // 3. Check off Backflip in solo room
    let checkoff_res = server
        .post(&format!("/goals/{}/checkoff", goal_id))
        .add_header("x-user-token", user_token)
        .json(&json!({
            "notes": "Landed on grass!"
        }))
        .await;
    checkoff_res.assert_status_ok();

    // 4. Verify the activity was auto-forwarded to the squad
    let squad_data_res = server
        .get(&format!("/room/{}", squad_slug))
        .add_header("x-user-token", user_token)
        .await;
    squad_data_res.assert_status_ok();
    let squad_data: serde_json::Value = squad_data_res.json();
    let squad_activities = squad_data["data"]["recent_activities"].as_array().unwrap();
    let fwd_act = squad_activities
        .iter()
        .find(|a| a["exercise_name"] == "Backflip")
        .expect("Backflip should be auto-forwarded to squad");
    assert_eq!(fwd_act["activity_type"], "ability");
    assert_eq!(fwd_act["notes"], "Landed on grass!");
}

#[test]
fn test_sally_multi_category_personal_progress_and_leaderboard() {
    let mut conn = setup_test_db();
    let sally_token = "token_sally_athlete";

    // 1. Initial user setup with auto-generated nickname
    let user = get_or_create_user(&conn, sally_token, "sally-squad").expect("user");
    assert_eq!(user.personal_stats.total_weight, 0.0);
    assert_eq!(user.personal_stats.total_distance, 0.0);
    assert_eq!(user.personal_stats.total_elevation, 0.0);

    // 2. Log weight workout under initial default nickname
    log_single_activity(
        &mut conn,
        &user,
        "sally-squad",
        &LogActivityRequest {
            room_slug: Some("sally-squad".to_string()),
            user_nickname: None,
            user_avatar_color: None,
            user_avatar_emoji: None,
            activity_type: "weight".to_string(),
            exercise_name: Some("Deadlift".to_string()),
            sets: Some(3),
            reps: Some(5),
            weight_per_rep: Some(300.0),
            distance_val: None,
            elevation_val: None,
            total_metric: Some(1500.0),
            notes: None,
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
    )
    .expect("log weight");

    // 3. User updates nickname to "Sally"
    let updated_user = update_user_profile(
        &conn,
        sally_token,
        &UpdateProfileRequest {
            nickname: Some("Sally".to_string()),
            avatar_color: Some("#ec4899".to_string()),
            avatar_emoji: Some("💪".to_string()),
            current_room_slug: None,
        },
    )
    .expect("update profile");
    assert_eq!(updated_user.nickname, "Sally");
    assert_eq!(updated_user.personal_stats.total_weight, 1500.0);

    // 4. Sally logs distance workout
    log_single_activity(
        &mut conn,
        &updated_user,
        "sally-squad",
        &LogActivityRequest {
            room_slug: Some("sally-squad".to_string()),
            user_nickname: Some("Sally".to_string()),
            user_avatar_color: Some("#ec4899".to_string()),
            user_avatar_emoji: Some("💪".to_string()),
            activity_type: "distance".to_string(),
            exercise_name: Some("Trail Run".to_string()),
            sets: Some(1),
            reps: Some(1),
            weight_per_rep: None,
            distance_val: Some(5.2),
            elevation_val: None,
            total_metric: Some(5.2),
            notes: None,
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
    )
    .expect("log distance");

    // 5. Sally logs elevation workout
    log_single_activity(
        &mut conn,
        &updated_user,
        "sally-squad",
        &LogActivityRequest {
            room_slug: Some("sally-squad".to_string()),
            user_nickname: Some("Sally".to_string()),
            user_avatar_color: Some("#ec4899".to_string()),
            user_avatar_emoji: Some("💪".to_string()),
            activity_type: "elevation".to_string(),
            exercise_name: Some("Incline Mountain".to_string()),
            sets: Some(2),
            reps: Some(1),
            weight_per_rep: None,
            distance_val: None,
            elevation_val: Some(800.0),
            total_metric: Some(800.0),
            notes: None,
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
    )
    .expect("log elevation");

    // 6. Sally logs an ability feat
    log_single_activity(
        &mut conn,
        &updated_user,
        "sally-squad",
        &LogActivityRequest {
            room_slug: Some("sally-squad".to_string()),
            user_nickname: Some("Sally".to_string()),
            user_avatar_color: Some("#ec4899".to_string()),
            user_avatar_emoji: Some("💪".to_string()),
            activity_type: "ability".to_string(),
            exercise_name: Some("Handstand Pushup".to_string()),
            sets: Some(1),
            reps: Some(1),
            weight_per_rep: None,
            distance_val: None,
            elevation_val: None,
            total_metric: Some(1.0),
            notes: None,
            goal_id: None,
            created_at: None,
            parent_activity_id: None,
            is_pr: None,
        },
    )
    .expect("log feat");

    // 7. Verify personal stats across all categories
    let stats = get_user_personal_stats(&conn, sally_token).expect("personal stats");
    assert_eq!(stats.total_weight, 1500.0);
    assert_eq!(stats.total_distance, 5.2);
    assert_eq!(stats.total_elevation, 800.0);
    assert_eq!(stats.total_sets, 7); // 3 + 1 + 2 + 1
    assert_eq!(stats.total_feats, 1);

    // 8. Verify get_or_create_user carries the populated personal_stats
    let profile = get_or_create_user(&conn, sally_token, "sally-squad").expect("profile");
    assert_eq!(profile.personal_stats.total_weight, 1500.0);
    assert_eq!(profile.personal_stats.total_distance, 5.2);
    assert_eq!(profile.personal_stats.total_elevation, 800.0);
    assert_eq!(profile.personal_stats.total_sets, 7);
    assert_eq!(profile.personal_stats.total_feats, 1);

    // 9. Verify room leaderboard aggregates Sally into exactly ONE entry with all categories populated
    let lb = get_leaderboard(&conn, "sally-squad").expect("leaderboard");
    assert_eq!(
        lb.len(),
        1,
        "Sally should be grouped into a single leaderboard row"
    );
    assert_eq!(lb[0].nickname, "Sally");
    assert_eq!(lb[0].total_weight, 1500.0);
    assert_eq!(lb[0].total_distance, 5.2);
    assert_eq!(lb[0].total_elevation, 800.0);
    assert_eq!(lb[0].total_sets, 7);
}
