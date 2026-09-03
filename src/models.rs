use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Room {
    pub id: i64,
    pub slug: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub user_token: String,
    pub nickname: String,
    pub avatar_color: String,
    pub current_room_slug: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub nickname: Option<String>,
    pub avatar_color: Option<String>,
    pub current_room_slug: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Goal {
    pub id: i64,
    pub room_slug: String,
    pub title: String,
    pub category: String, // "weight", "distance", "elevation"
    pub target_value: f64,
    pub current_value: f64,
    pub unit: String, // "lbs", "kg", "mi", "km", "ft", "m"
    pub theme_key: String, // "pando", "whale", "caribou", "everest", "custom"
    pub status: String, // "active", "completed"
    pub description: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateGoalRequest {
    pub title: String,
    pub category: String,
    pub target_value: f64,
    pub unit: String,
    pub theme_key: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Activity {
    pub id: i64,
    pub room_slug: String,
    pub user_token: String,
    pub user_nickname: String,
    pub user_avatar_color: String,
    pub goal_id: Option<i64>,
    pub activity_type: String, // "weight", "distance", "elevation"
    pub exercise_name: String,
    pub sets: i32,
    pub reps: i32,
    pub weight_per_rep: f64,
    pub distance_val: f64,
    pub elevation_val: f64,
    pub total_metric: f64,
    pub notes: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct LogActivityRequest {
    pub room_slug: Option<String>,
    pub user_nickname: Option<String>,
    pub user_avatar_color: Option<String>,
    pub activity_type: String, // "weight", "distance", "elevation"
    pub exercise_name: Option<String>,
    pub sets: Option<i32>,
    pub reps: Option<i32>,
    pub weight_per_rep: Option<f64>,
    pub distance_val: Option<f64>,
    pub elevation_val: Option<f64>,
    pub total_metric: Option<f64>,
    pub notes: Option<String>,
    pub goal_id: Option<i64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BatchLogActivityRequest {
    pub room_slug: Option<String>,
    pub user_nickname: Option<String>,
    pub user_avatar_color: Option<String>,
    pub activities: Vec<LogActivityRequest>,
}

#[derive(Debug, Deserialize)]
pub struct CheerRequest {
    pub room_slug: String,
    pub emoji: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateGoalWishlistRequest {
    pub room_slug: String,
    pub title: String,
    pub category: String,
    pub target_value: f64,
    pub unit: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalWishlistItem {
    pub id: i64,
    pub user_token: String,
    pub room_slug: String,
    pub title: String,
    pub category: String,
    pub target_value: f64,
    pub unit: String,
    pub notes: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardMember {
    pub user_token: String,
    pub nickname: String,
    pub avatar_color: String,
    pub total_weight: f64,
    pub total_distance: f64,
    pub total_elevation: f64,
    pub total_sets: i32,
    pub weight_percentage: f64,
    pub is_daily_mvp: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomDataResponse {
    pub room: Room,
    pub user_profile: UserProfile,
    pub active_goals: Vec<Goal>,
    pub completed_goals: Vec<Goal>,
    pub recent_activities: Vec<Activity>,
    pub leaderboard: Vec<LeaderboardMember>,
    pub wishlists: Vec<GoalWishlistItem>,
}
