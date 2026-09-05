use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Room {
    pub id: i64,
    pub slug: String,
    pub name: String,
    pub created_at: String,
    #[serde(default)]
    pub creator_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomMember {
    pub user_token: String,
    pub nickname: String,
    pub avatar_color: String,
    #[serde(default)]
    pub avatar_emoji: String,
    pub role: String, // "creator" | "member"
    pub is_creator: bool,
    pub joined_at: String,
    pub total_metric: f64,
    pub total_sets: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSquadSummary {
    pub slug: String,
    pub name: String,
    pub role: String,
    pub is_creator: bool,
    pub member_count: i64,
    pub joined_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateRoomRequest {
    pub name: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct RenameRoomRequest {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UserPersonalStats {
    pub total_weight: f64,
    pub total_distance: f64,
    pub total_elevation: f64,
    pub total_sets: i64,
    pub total_feats: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub user_token: String,
    pub nickname: String,
    pub avatar_color: String,
    #[serde(default)]
    pub avatar_emoji: String,
    pub current_room_slug: String,
    pub updated_at: String,
    #[serde(default)]
    pub streak_days: i32,
    #[serde(default)]
    pub tardigrade_state: String,
    #[serde(default)]
    pub personal_stats: UserPersonalStats,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateProfileRequest {
    pub nickname: Option<String>,
    pub avatar_color: Option<String>,
    pub avatar_emoji: Option<String>,
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
    pub unit: String,      // "lbs", "kg", "mi", "km", "ft", "m"
    pub theme_key: String, // "pando", "whale", "caribou", "everest", "custom"
    pub status: String,    // "active", "completed"
    pub description: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateGoalRequest {
    pub room_slug: Option<String>,
    pub title: String,
    pub category: String,
    pub target_value: f64,
    pub unit: String,
    pub theme_key: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Clone, Default)]
pub struct CheckoffGoalRequest {
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckoffGoalResponse {
    pub goal: Goal,
    pub activity: Activity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Activity {
    pub id: i64,
    pub room_slug: String,
    pub user_token: String,
    pub user_nickname: String,
    pub user_avatar_color: String,
    #[serde(default)]
    pub user_avatar_emoji: String,
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
    #[serde(default)]
    pub parent_activity_id: Option<i64>,
    #[serde(default)]
    pub is_pr: bool,
}

impl Activity {
    pub fn to_forwarded_request(&self, squad_slug: &str) -> LogActivityRequest {
        LogActivityRequest {
            room_slug: Some(squad_slug.to_string()),
            user_nickname: Some(self.user_nickname.clone()),
            user_avatar_color: Some(self.user_avatar_color.clone()),
            user_avatar_emoji: Some(self.user_avatar_emoji.clone()),
            activity_type: self.activity_type.clone(),
            exercise_name: Some(self.exercise_name.clone()),
            sets: Some(self.sets),
            reps: Some(self.reps),
            weight_per_rep: Some(self.weight_per_rep),
            distance_val: Some(self.distance_val),
            elevation_val: Some(self.elevation_val),
            total_metric: Some(self.total_metric),
            notes: Some(self.notes.clone()),
            goal_id: None,
            created_at: Some(self.created_at.clone()),
            parent_activity_id: Some(self.id),
            is_pr: Some(self.is_pr),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalRecord {
    pub exercise_name: String,
    pub activity_type: String,
    pub max_weight: f64,
    pub max_reps: i32,
    pub max_distance: f64,
    pub max_elevation: f64,
}

#[derive(Debug, Deserialize, Clone, Default)]
pub struct LogActivityRequest {
    pub room_slug: Option<String>,
    pub user_nickname: Option<String>,
    pub user_avatar_color: Option<String>,
    pub user_avatar_emoji: Option<String>,
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
    #[serde(default)]
    pub parent_activity_id: Option<i64>,
    #[serde(default)]
    pub is_pr: Option<bool>,
}

#[derive(Debug, Deserialize, Default)]
pub struct BatchLogActivityRequest {
    pub room_slug: Option<String>,
    pub user_nickname: Option<String>,
    pub user_avatar_color: Option<String>,
    pub user_avatar_emoji: Option<String>,
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
    #[serde(default)]
    pub user_nickname: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalWishlistItem {
    pub id: i64,
    pub user_token: String,
    #[serde(default)]
    pub user_nickname: String,
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
    #[serde(default)]
    pub avatar_emoji: String,
    pub total_weight: f64,
    pub total_distance: f64,
    pub total_elevation: f64,
    pub total_sets: i32,
    pub weight_percentage: f64,
    #[serde(default)]
    pub distance_percentage: f64,
    #[serde(default)]
    pub elevation_percentage: f64,
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
    #[serde(default)]
    pub members: Vec<RoomMember>,
    #[serde(default)]
    pub user_squads: Vec<UserSquadSummary>,
    #[serde(default)]
    pub personal_records: Vec<PersonalRecord>,
}
