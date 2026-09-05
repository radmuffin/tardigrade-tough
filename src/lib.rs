pub mod db;
pub mod models;
pub mod routes;
pub mod store;

use db::init_db;
use fly_common::prelude::*;
use fly_common::ws::BroadcastHub;
use routes::AppState;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};

pub type DbConn = Arc<Mutex<Connection>>;
pub type AppResult<T> = Result<T, Box<dyn std::error::Error>>;

pub fn build_app_state(db_path: &str) -> AppResult<(AppState, DbConn)> {
    let db = FlyDb::open_shared(db_path)?;
    {
        let mut conn = db.lock().unwrap();
        init_db(&mut conn)?;
    }

    let hub = Arc::new(BroadcastHub::new(256));
    let state = AppState::new(db.clone(), hub);

    Ok((state, db))
}
