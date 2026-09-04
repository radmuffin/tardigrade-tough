use axum_test::TestServer;
use fly_common::ws::BroadcastHub;
use rusqlite::Connection;
use serde_json::json;
use std::sync::{Arc, Mutex};
use tardigrade_tough::db::*;
use tardigrade_tough::models::*;
use tardigrade_tough::routes::{create_routes, AppState};

fn setup_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("in-memory db failed");
    init_db(&mut conn).expect("init_db failed");
    conn
}

#[test]
fn test_db_initialization_and_default_seeds() {
    let conn = setup_test_db();

    let room = get_or_create_room(&conn, "main").expect("room");
    assert_eq!(room.slug, "main");
    assert_eq!(room.name, "Pando Squad");

    let (active, completed) = get_goals_for_room(&conn, "main").expect("goals");
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
        },
        LogActivityRequest {
            room_slug: Some("main".to_string()),
            user_nickname: Some("Samantha".to_string()),
            user_avatar_color: Some("#ec4899".to_string()),
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
    assert_eq!(authorized_del.as_deref(), Some("main"));

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

    let req = CreateGoalWishlistRequest {
        room_slug: "main".to_string(),
        title: "General Sherman Giant Sequoia".to_string(),
        category: "weight".to_string(),
        target_value: 2_700_000.0,
        unit: "lbs".to_string(),
        notes: Some("Largest known living single-stem tree".to_string()),
    };

    let item = create_goal_wishlist(&conn, "token_submitter", &req).expect("wishlist ok");
    assert_eq!(item.title, "General Sherman Giant Sequoia");
    assert_eq!(item.target_value, 2_700_000.0);
    assert_eq!(item.category, "weight");
    assert_eq!(item.notes, "Largest known living single-stem tree");
}

#[test]
fn test_goal_completion_transition() {
    let mut conn = setup_test_db();
    let user = get_or_create_user(&conn, "token_mega_lifter", "solo_quest").expect("user");

    log_single_activity(
        &mut conn,
        &user,
        "solo_quest",
        &LogActivityRequest {
            room_slug: Some("solo_quest".to_string()),
            user_nickname: None,
            user_avatar_color: None,
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
        },
    )
    .expect("trek log");

    let (_, completed) = get_goals_for_room(&conn, "solo_quest").expect("goals");
    let finished_caribou = completed.iter().find(|g| g.theme_key == "caribou");
    assert!(finished_caribou.is_some());
    assert_eq!(finished_caribou.unwrap().status, "completed");
    assert_eq!(finished_caribou.unwrap().current_value, 3050.0);
}

// =========================================================================
// AXUM HTTP API ROUTE ENDPOINT INTEGRATION TESTS
// =========================================================================

#[tokio::test]
async fn test_api_info_endpoint() {
    let conn = setup_test_db();
    let db = Arc::new(Mutex::new(conn));
    let hub = Arc::new(BroadcastHub::new(256));
    let state = AppState { db, hub };
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
    let state = AppState { db, hub };
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
    let state = AppState { db, hub };
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
    let state = AppState { db, hub };
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
    let state = AppState { db, hub };
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
