mod db;
mod models;
mod routes;

use db::init_db;
use fly_common::prelude::*;
use fly_common::ws::BroadcastHub;
use routes::{create_routes, AppState};
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Initialize SQLite connection with WAL mode & production pragmas
    let db_path = std::env::var("DATABASE_PATH").unwrap_or_else(|_| "tardigrade.db".into());
    let db = FlyDb::open_shared(&db_path)?;

    // 2. Run initial schema migrations & seed default goals
    {
        let mut conn = db.lock().unwrap();
        init_db(&mut conn)?;
    }

    // 3. Initialize WebSocket Pub/Sub Broadcast Hub
    let hub = Arc::new(BroadcastHub::new(256));

    let state = AppState {
        db: db.clone(),
        hub: hub.clone(),
    };

    // 4. Define API router
    let api = create_routes(state);

    // 5. Start FlyServer
    FlyServer::builder()
        .with_app_info("Tardigrade Tough", "0.1.0")
        .nest("/api", api)
        .with_static_dir("static")
        .serve()
        .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use models::*;
    use rusqlite::Connection;

    #[test]
    fn test_db_initialization_and_seeding() {
        let mut conn = Connection::open_in_memory().expect("in-memory db");
        init_db(&mut conn).expect("db init ok");

        // Verify default room
        let room = db::get_or_create_room(&conn, "main").expect("room found");
        assert_eq!(room.slug, "main");

        // Verify seeded goals
        let (active, completed) = db::get_goals_for_room(&conn, "main").expect("goals found");
        assert_eq!(active.len(), 3); // Pando, Caribou, Everest
        assert_eq!(completed.len(), 1); // Blue Whale
        assert_eq!(active[0].theme_key, "pando");
        assert_eq!(completed[0].theme_key, "whale");
    }

    #[test]
    fn test_custom_room_creation_and_isolation() {
        let mut conn = Connection::open_in_memory().expect("in-memory db");
        init_db(&mut conn).expect("db init ok");

        // Create new squad room
        let room = db::get_or_create_room(&conn, "sally-bio-squad").expect("room create");
        assert_eq!(room.slug, "sally-bio-squad");
        assert_eq!(room.name, "sally bio squad Crew");

        // Fresh goals should start at 0
        let (active, completed) = db::get_goals_for_room(&conn, "sally-bio-squad").expect("goals found");
        assert_eq!(active.len(), 3);
        assert_eq!(active[0].current_value, 0.0);
        assert_eq!(completed.len(), 0);
    }

    #[test]
    fn test_activity_logging_and_auto_routing() {
        let mut conn = Connection::open_in_memory().expect("in-memory db");
        init_db(&mut conn).expect("db init ok");

        let user = db::get_or_create_user(&conn, "test_user_token_1", "main").expect("user");

        // Log 10 reps of 140 lbs squat (1,400 lbs)
        let log_req = LogActivityRequest {
            room_slug: Some("main".to_string()),
            user_nickname: None,
            user_avatar_color: None,
            activity_type: "weight".to_string(),
            exercise_name: Some("Back Squat".to_string()),
            sets: Some(1),
            reps: Some(10),
            weight_per_rep: Some(140.0),
            distance_val: None,
            elevation_val: None,
            total_metric: None,
            notes: Some("Felt super clean".to_string()),
            goal_id: None,
            created_at: None,
        };

        let act = db::log_single_activity(&mut conn, &user, "main", &log_req).expect("log ok");
        assert_eq!(act.total_metric, 1400.0);
        assert_eq!(act.exercise_name, "Back Squat");

        // Verify Pando was incremented by 1,400 lbs (initial seed was 1,850 lbs -> now 3,250 lbs)
        let (active, _) = db::get_goals_for_room(&conn, "main").expect("goals");
        let pando = active.iter().find(|g| g.theme_key == "pando").unwrap();
        assert_eq!(pando.current_value, 3250.0);

        // Verify leaderboard
        let lb = db::get_leaderboard(&conn, "main").expect("leaderboard");
        assert_eq!(lb.len(), 1);
        assert_eq!(lb[0].total_weight, 1400.0);
        assert!(lb[0].is_daily_mvp);
    }

    #[test]
    fn test_batch_sheet_import_with_nicknames() {
        let mut conn = Connection::open_in_memory().expect("in-memory db");
        init_db(&mut conn).expect("db init ok");

        let user = db::get_or_create_user(&conn, "test_user_token_sally", "main").expect("user");

        let items = vec![
            LogActivityRequest {
                room_slug: Some("main".to_string()),
                user_nickname: Some("Sally".to_string()),
                user_avatar_color: Some("#f59e0b".to_string()),
                activity_type: "weight".to_string(),
                exercise_name: Some("Sheet Lift".to_string()),
                sets: Some(1),
                reps: Some(10),
                weight_per_rep: Some(140.0),
                distance_val: None,
                elevation_val: None,
                total_metric: Some(1400.0),
                notes: Some("Row 1".to_string()),
                goal_id: None,
                created_at: None,
            },
            LogActivityRequest {
                room_slug: Some("main".to_string()),
                user_nickname: Some("Sally".to_string()),
                user_avatar_color: Some("#f59e0b".to_string()),
                activity_type: "weight".to_string(),
                exercise_name: Some("Sheet Lift".to_string()),
                sets: Some(1),
                reps: Some(40),
                weight_per_rep: Some(208.0),
                distance_val: None,
                elevation_val: None,
                total_metric: Some(8320.0),
                notes: Some("Row 2".to_string()),
                goal_id: None,
                created_at: None,
            },
        ];

        for item in &items {
            db::log_single_activity(&mut conn, &user, "main", item).expect("batch item ok");
        }

        let lb = db::get_leaderboard(&conn, "main").expect("leaderboard");
        assert_eq!(lb.len(), 1);
        assert_eq!(lb[0].nickname, "Sally");
        assert_eq!(lb[0].total_weight, 9720.0); // 1400 + 8320
    }

    #[test]
    fn test_activity_deletion_and_rollback() {
        let mut conn = Connection::open_in_memory().expect("in-memory db");
        init_db(&mut conn).expect("db init ok");

        let user = db::get_or_create_user(&conn, "user_del_token", "main").expect("user");

        let log_req = LogActivityRequest {
            room_slug: Some("main".to_string()),
            user_nickname: None,
            user_avatar_color: None,
            activity_type: "weight".to_string(),
            exercise_name: Some("Deadlift".to_string()),
            sets: Some(1),
            reps: Some(5),
            weight_per_rep: Some(300.0),
            distance_val: None,
            elevation_val: None,
            total_metric: Some(1500.0),
            notes: None,
            goal_id: None,
            created_at: None,
        };

        let act = db::log_single_activity(&mut conn, &user, "main", &log_req).expect("log");
        let (active_before, _) = db::get_goals_for_room(&conn, "main").expect("goals");
        let pando_before = active_before.iter().find(|g| g.theme_key == "pando").unwrap().current_value;

        // Delete activity
        let deleted = db::delete_activity(&mut conn, act.id, "user_del_token").expect("del ok");
        assert!(deleted);

        let (active_after, _) = db::get_goals_for_room(&conn, "main").expect("goals");
        let pando_after = active_after.iter().find(|g| g.theme_key == "pando").unwrap().current_value;

        assert_eq!(pando_after, pando_before - 1500.0);
    }
}
