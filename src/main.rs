use fly_common::prelude::*;
use tardigrade_tough::{build_app_state, routes::create_routes};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db_path = std::env::var("DATABASE_PATH").unwrap_or_else(|_| "tardigrade.db".into());
    let (state, _) = build_app_state(&db_path)?;

    let api = create_routes(state);

    FlyServer::builder()
        .with_app_info("Tardigrade Tough", "0.1.0")
        .nest("/api", api)
        .with_static_dir("static")
        .serve()
        .await
}
