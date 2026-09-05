use crate::db::*;
use crate::models::{
    Activity, BatchLogActivityRequest, CheerRequest, CreateGoalRequest, CreateGoalWishlistRequest,
    Goal, GoalWishlistItem, LogActivityRequest, RenameRoomRequest, Room, RoomDataResponse,
    UpdateProfileRequest, UserProfile as AppUserProfile,
};
use axum::{
    extract::{
        ws::{WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use fly_common::prelude::{ApiResponse, DbPool, UserToken};
use fly_common::qr::generate_qr_svg;
use fly_common::ws::{BroadcastHub, WsMessage};
use serde::Deserialize;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: DbPool,
    pub hub: Arc<BroadcastHub>,
}

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub room: Option<String>,
    pub token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct QrQuery {
    pub url: String,
}

pub fn create_routes(state: AppState) -> Router {
    Router::new()
        .route("/room/:slug", get(get_room_data))
        .route("/room/:slug/name", post(rename_room_handler))
        .route("/users/profile", post(update_profile))
        .route("/activities", post(log_activity))
        .route("/activities/batch", post(log_batch_activities))
        .route("/activities/:id", delete(delete_activity_handler))
        .route("/cheer", post(cheer_handler))
        .route("/goals", post(create_goal_handler))
        .route("/goals/wishlist", post(create_wishlist_handler))
        .route("/qr", get(qr_handler))
        .route("/ws", get(ws_handler))
        .with_state(state)
}

async fn get_room_data(
    user: UserToken,
    Path(slug): Path<String>,
    State(state): State<AppState>,
) -> (StatusCode, Json<ApiResponse<RoomDataResponse>>) {
    let clean_slug = slug.trim().to_lowercase();
    let conn = state.db.lock().unwrap();

    let room = match get_or_create_room(&conn, &clean_slug) {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(e.to_string())),
            )
        }
    };

    let user_profile = match get_or_create_user(&conn, user.as_str(), &clean_slug) {
        Ok(u) => u,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(e.to_string())),
            )
        }
    };

    let (active_goals, completed_goals) = match get_goals_for_room(&conn, &clean_slug) {
        Ok(g) => g,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(e.to_string())),
            )
        }
    };

    let recent_activities = get_recent_activities(&conn, &clean_slug, 50).unwrap_or_default();
    let leaderboard = get_leaderboard(&conn, &clean_slug).unwrap_or_default();
    let wishlists = get_wishlists(&conn, &clean_slug).unwrap_or_default();

    (
        StatusCode::OK,
        Json(ApiResponse::ok(RoomDataResponse {
            room,
            user_profile,
            active_goals,
            completed_goals,
            recent_activities,
            leaderboard,
            wishlists,
        })),
    )
}

async fn rename_room_handler(
    user: UserToken,
    Path(slug): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<RenameRoomRequest>,
) -> (StatusCode, Json<ApiResponse<Room>>) {
    let clean_slug = slug.trim().to_lowercase();
    let clean_name = payload.name.trim();

    if clean_name.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err("Squad name cannot be empty")),
        );
    }
    if clean_name.chars().count() > 50 {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err("Squad name must be 50 characters or less")),
        );
    }

    let conn = state.db.lock().unwrap();
    match update_room_name(&conn, &clean_slug, clean_name) {
        Ok(room) => {
            let _ = state.hub.broadcast(WsMessage {
                room: clean_slug,
                event: "room_renamed".to_string(),
                sender_token: Some(user.as_str().to_string()),
                payload: serde_json::json!({
                    "room": room,
                }),
            });
            (StatusCode::OK, Json(ApiResponse::ok(room)))
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(e.to_string())),
        ),
    }
}

async fn update_profile(
    user: UserToken,
    State(state): State<AppState>,
    Json(payload): Json<UpdateProfileRequest>,
) -> (StatusCode, Json<ApiResponse<AppUserProfile>>) {
    let conn = state.db.lock().unwrap();
    match update_user_profile(&conn, user.as_str(), &payload) {
        Ok(profile) => {
            // Broadcast profile update event to current room
            let _ = state.hub.broadcast(WsMessage {
                room: profile.current_room_slug.clone(),
                event: "profile_updated".to_string(),
                sender_token: Some(user.as_str().to_string()),
                payload: serde_json::to_value(&profile).unwrap_or_default(),
            });

            (StatusCode::OK, Json(ApiResponse::ok(profile)))
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(e.to_string())),
        ),
    }
}

async fn log_activity(
    user: UserToken,
    State(state): State<AppState>,
    Json(payload): Json<LogActivityRequest>,
) -> (StatusCode, Json<ApiResponse<Activity>>) {
    let mut conn = state.db.lock().unwrap();
    let user_profile = match get_or_create_user(&conn, user.as_str(), "main") {
        Ok(u) => u,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(e.to_string())),
            )
        }
    };

    let room_slug = payload
        .room_slug
        .clone()
        .unwrap_or_else(|| user_profile.current_room_slug.clone());

    match log_single_activity(&mut conn, &user_profile, &room_slug, &payload) {
        Ok(activity) => {
            // Broadcast activity to room
            let (active_goals, _) = get_goals_for_room(&conn, &room_slug).unwrap_or_default();
            let leaderboard = get_leaderboard(&conn, &room_slug).unwrap_or_default();

            let _ = state.hub.broadcast(WsMessage {
                room: room_slug.clone(),
                event: "activity_logged".to_string(),
                sender_token: Some(user.as_str().to_string()),
                payload: serde_json::json!({
                    "activity": activity,
                    "active_goals": active_goals,
                    "leaderboard": leaderboard,
                }),
            });

            (StatusCode::CREATED, Json(ApiResponse::ok(activity)))
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(e.to_string())),
        ),
    }
}

async fn log_batch_activities(
    user: UserToken,
    State(state): State<AppState>,
    Json(payload): Json<BatchLogActivityRequest>,
) -> (StatusCode, Json<ApiResponse<Vec<Activity>>>) {
    if payload.activities.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err("No activities in batch")),
        );
    }

    let mut conn = state.db.lock().unwrap();
    let user_profile = match get_or_create_user(&conn, user.as_str(), "main") {
        Ok(u) => u,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(e.to_string())),
            )
        }
    };

    let room_slug = payload
        .room_slug
        .clone()
        .unwrap_or_else(|| user_profile.current_room_slug.clone());

    let mut created = Vec::new();

    for mut req in payload.activities {
        if req.user_nickname.is_none() && payload.user_nickname.is_some() {
            req.user_nickname = payload.user_nickname.clone();
        }
        if req.user_avatar_color.is_none() && payload.user_avatar_color.is_some() {
            req.user_avatar_color = payload.user_avatar_color.clone();
        }
        match log_single_activity(&mut conn, &user_profile, &room_slug, &req) {
            Ok(act) => created.push(act),
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ApiResponse::err(format!("Batch failed: {}", e))),
                );
            }
        }
    }

    let (active_goals, _) = get_goals_for_room(&conn, &room_slug).unwrap_or_default();
    let leaderboard = get_leaderboard(&conn, &room_slug).unwrap_or_default();

    let _ = state.hub.broadcast(WsMessage {
        room: room_slug.clone(),
        event: "batch_activities_logged".to_string(),
        sender_token: Some(user.as_str().to_string()),
        payload: serde_json::json!({
            "count": created.len(),
            "active_goals": active_goals,
            "leaderboard": leaderboard,
        }),
    });

    (StatusCode::CREATED, Json(ApiResponse::ok(created)))
}

async fn delete_activity_handler(
    user: UserToken,
    Path(id): Path<i64>,
    State(state): State<AppState>,
) -> (StatusCode, Json<ApiResponse<bool>>) {
    let mut conn = state.db.lock().unwrap();

    match delete_activity(&mut conn, id, user.as_str()) {
        Ok(Some(room_slug)) => {
            let (active_goals, _) = get_goals_for_room(&conn, &room_slug).unwrap_or_default();
            let leaderboard = get_leaderboard(&conn, &room_slug).unwrap_or_default();

            let _ = state.hub.broadcast(WsMessage {
                room: room_slug,
                event: "activity_deleted".to_string(),
                sender_token: Some(user.as_str().to_string()),
                payload: serde_json::json!({
                    "activity_id": id,
                    "active_goals": active_goals,
                    "leaderboard": leaderboard,
                }),
            });

            (StatusCode::OK, Json(ApiResponse::ok(true)))
        }
        Ok(None) => (
            StatusCode::FORBIDDEN,
            Json(ApiResponse::err("Activity not found or unauthorized")),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(e.to_string())),
        ),
    }
}

async fn cheer_handler(
    user: UserToken,
    State(state): State<AppState>,
    Json(payload): Json<CheerRequest>,
) -> (StatusCode, Json<ApiResponse<bool>>) {
    let conn = state.db.lock().unwrap();
    let user_profile =
        get_or_create_user(&conn, user.as_str(), &payload.room_slug).unwrap_or_else(|_| {
            AppUserProfile {
                user_token: user.as_str().to_string(),
                nickname: "GymMate".to_string(),
                avatar_color: "#10b981".to_string(),
                current_room_slug: payload.room_slug.clone(),
                updated_at: "".to_string(),
            }
        });

    let _ = state.hub.broadcast(WsMessage {
        room: payload.room_slug,
        event: "cheer_reaction".to_string(),
        sender_token: Some(user.as_str().to_string()),
        payload: serde_json::json!({
            "emoji": payload.emoji,
            "user_nickname": user_profile.nickname,
            "user_avatar_color": user_profile.avatar_color,
        }),
    });

    (StatusCode::OK, Json(ApiResponse::ok(true)))
}

async fn create_goal_handler(
    _user: UserToken,
    State(state): State<AppState>,
    Json(payload): Json<CreateGoalRequest>,
) -> (StatusCode, Json<ApiResponse<Goal>>) {
    let conn = state.db.lock().unwrap();
    let room_slug = payload.room_slug.as_deref().unwrap_or("main");
    match create_custom_goal(&conn, room_slug, &payload) {
        Ok(goal) => {
            let _ = state.hub.broadcast(WsMessage {
                room: goal.room_slug.clone(),
                event: "goal_created".to_string(),
                sender_token: None,
                payload: serde_json::to_value(&goal).unwrap_or_default(),
            });
            (StatusCode::CREATED, Json(ApiResponse::ok(goal)))
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(e.to_string())),
        ),
    }
}

async fn create_wishlist_handler(
    user: UserToken,
    State(state): State<AppState>,
    Json(payload): Json<CreateGoalWishlistRequest>,
) -> (StatusCode, Json<ApiResponse<GoalWishlistItem>>) {
    let conn = state.db.lock().unwrap();
    match create_goal_wishlist(&conn, user.as_str(), &payload) {
        Ok(item) => {
            let _ = state.hub.broadcast(WsMessage {
                room: item.room_slug.clone(),
                event: "wishlist_added".to_string(),
                sender_token: Some(user.as_str().to_string()),
                payload: serde_json::to_value(&item).unwrap_or_default(),
            });

            // If GITHUB_TOKEN is configured in environment, dispatch automated GitHub issue
            let item_clone = item.clone();
            tokio::spawn(async move {
                dispatch_github_issue_if_configured(&item_clone).await;
            });

            (StatusCode::CREATED, Json(ApiResponse::ok(item)))
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(e.to_string())),
        ),
    }
}

pub fn format_github_issue_body(item: &GoalWishlistItem) -> String {
    let notes_formatted = if item.notes.trim().is_empty() {
        "*(No additional notes provided)*".to_string()
    } else {
        format!("> {}", item.notes.trim())
    };

    let proposed_by = if item.user_nickname.trim().is_empty() {
        format!("`{}`", item.user_token)
    } else {
        format!("{} (`{}`)", item.user_nickname.trim(), item.user_token)
    };

    format!(
        "### 🌲 New Quest Proposal from Tardigrade Tough\n\n\
         - **Quest Title**: {}\n\
         - **Category**: `{}`\n\
         - **Target Metric**: {} {}\n\
         - **Squad Room**: `{}`\n\
         - **Proposed by**: {}\n\n\
         #### 📝 Notes & Lore\n\
         {}\n\n\
         ---\n\
         *Automated proposal submitted via Tardigrade Tough app.*",
        item.title,
        item.category,
        item.target_value,
        item.unit,
        item.room_slug,
        proposed_by,
        notes_formatted
    )
}

async fn dispatch_github_issue_if_configured(item: &GoalWishlistItem) {
    let raw_token = match std::env::var("GITHUB_TOKEN")
        .or_else(|_| std::env::var("GH_TOKEN"))
        .or_else(|_| std::env::var("GITHUB_PAT"))
        .or_else(|_| std::env::var("GH_PAT"))
    {
        Ok(t) if !t.trim().is_empty() => t,
        _ => return,
    };

    let token = raw_token
        .trim()
        .strip_prefix("Bearer ")
        .or_else(|| raw_token.trim().strip_prefix("token "))
        .unwrap_or(raw_token.trim())
        .trim();

    let repo =
        std::env::var("GITHUB_REPO").unwrap_or_else(|_| "radmuffin/tardigrade-tough".to_string());
    let url = format!("https://api.github.com/repos/{repo}/issues");

    let title = format!("[Quest Proposal] {} ({})", item.title, item.category);
    let body = format_github_issue_body(item);

    let client = reqwest::Client::new();
    let auth_header = format!("Bearer {token}");

    // First attempt: include quest-proposal label
    let payload = serde_json::json!({
        "title": title,
        "body": body,
        "labels": ["quest-proposal"]
    });

    let res = client
        .post(&url)
        .header("Authorization", &auth_header)
        .header("User-Agent", "tardigrade-tough-app")
        .header("Accept", "application/vnd.github+json")
        .json(&payload)
        .send()
        .await;

    match res {
        Ok(resp) if resp.status().is_success() => {
            println!(
                "Successfully created GitHub issue for quest: {}",
                item.title
            );
        }
        Ok(resp) if resp.status() == reqwest::StatusCode::UNPROCESSABLE_ENTITY => {
            // Label might not exist on the repo; retry cleanly without labels
            let retry_payload = serde_json::json!({
                "title": title,
                "body": body
            });
            match client
                .post(&url)
                .header("Authorization", &auth_header)
                .header("User-Agent", "tardigrade-tough-app")
                .header("Accept", "application/vnd.github+json")
                .json(&retry_payload)
                .send()
                .await
            {
                Ok(retry_resp) if retry_resp.status().is_success() => {
                    println!(
                        "Successfully created GitHub issue for quest (without labels): {}",
                        item.title
                    );
                }
                Ok(retry_resp) => {
                    let status = retry_resp.status();
                    let err_body = retry_resp.text().await.unwrap_or_default();
                    eprintln!("GitHub API returned {status} on retry: {err_body}");
                }
                Err(e) => {
                    eprintln!("Failed to dispatch GitHub issue on retry: {e}");
                }
            }
        }
        Ok(resp) => {
            let status = resp.status();
            let err_body = resp.text().await.unwrap_or_default();
            eprintln!("GitHub API returned {status} when creating issue: {err_body}");
        }
        Err(e) => {
            eprintln!("Failed to dispatch GitHub issue for quest proposal: {e}");
        }
    }
}

async fn qr_handler(Query(query): Query<QrQuery>) -> Response {
    let qr_res = generate_qr_svg(&query.url, 256, 4);
    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, "image/svg+xml".parse().unwrap());
    headers.insert(
        header::CACHE_CONTROL,
        "public, max-age=86400".parse().unwrap(),
    );
    (headers, qr_res.svg).into_response()
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    State(state): State<AppState>,
) -> Response {
    let room = query.room.unwrap_or_else(|| "main".to_string());
    let token = query.token;
    let hub = state.hub.clone();

    ws.on_upgrade(move |socket: WebSocket| async move {
        hub.handle_socket(socket, room, token).await;
    })
}
