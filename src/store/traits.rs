use crate::models::*;
use std::fmt;

#[derive(Debug)]
pub enum StoreError {
    Sqlite(rusqlite::Error),
    NotFound(String),
    Validation(String),
    Unauthorized(String),
    Internal(String),
}

impl fmt::Display for StoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StoreError::Sqlite(e) => write!(f, "Database error: {e}"),
            StoreError::NotFound(msg) => write!(f, "Not found: {msg}"),
            StoreError::Validation(msg) => write!(f, "Validation error: {msg}"),
            StoreError::Unauthorized(msg) => write!(f, "Unauthorized: {msg}"),
            StoreError::Internal(msg) => write!(f, "Internal error: {msg}"),
        }
    }
}

impl std::error::Error for StoreError {}

impl From<rusqlite::Error> for StoreError {
    fn from(err: rusqlite::Error) -> Self {
        StoreError::Sqlite(err)
    }
}

pub type StoreResult<T> = Result<T, StoreError>;

pub trait RoomStore: Send + Sync {
    fn get_or_create_room(&self, slug: &str) -> StoreResult<Room>;
    fn update_room_name(&self, slug: &str, new_name: &str) -> StoreResult<Room>;
    fn ensure_room_member(&self, room_slug: &str, user_token: &str) -> StoreResult<()>;
    fn get_room_members(&self, room_slug: &str) -> StoreResult<Vec<RoomMember>>;
    fn leave_room(&self, room_slug: &str, user_token: &str) -> StoreResult<String>;
    fn remove_room_member(
        &self,
        room_slug: &str,
        creator_token: &str,
        target_token: &str,
    ) -> std::result::Result<String, String>;
    fn create_room_for_user(&self, user_token: &str, name: Option<&str>) -> StoreResult<Room>;
    fn get_user_squads(&self, user_token: &str) -> StoreResult<Vec<UserSquadSummary>>;
}

pub trait UserStore: Send + Sync {
    fn get_user_current_room(&self, token: &str) -> StoreResult<Option<String>>;
    fn calculate_user_streak(&self, user_token: &str) -> (i32, String);
    fn get_or_create_user(&self, token: &str, default_room: &str) -> StoreResult<UserProfile>;
    fn update_user_profile(
        &self,
        token: &str,
        req: &UpdateProfileRequest,
    ) -> StoreResult<UserProfile>;
    fn get_user_personal_records(&self, user_token: &str) -> StoreResult<Vec<PersonalRecord>>;
}

pub trait GoalStore: Send + Sync {
    fn get_goals_for_room(&self, room_slug: &str) -> StoreResult<(Vec<Goal>, Vec<Goal>)>;
    fn create_custom_goal(&self, room_slug: &str, req: &CreateGoalRequest) -> StoreResult<Goal>;
    fn create_goal_wishlist(
        &self,
        user_token: &str,
        req: &CreateGoalWishlistRequest,
    ) -> StoreResult<GoalWishlistItem>;
    fn get_wishlists(&self, room_slug: &str) -> StoreResult<Vec<GoalWishlistItem>>;
}

pub trait ActivityStore: Send + Sync {
    fn log_single_activity(
        &self,
        user: &UserProfile,
        target_room_slug: &str,
        req: &LogActivityRequest,
    ) -> StoreResult<Activity>;
    fn delete_activity(
        &self,
        activity_id: i64,
        user_token: &str,
    ) -> StoreResult<Option<Vec<String>>>;
    fn get_recent_activities(&self, room_slug: &str, limit: i64) -> StoreResult<Vec<Activity>>;
    fn get_leaderboard(&self, room_slug: &str) -> StoreResult<Vec<LeaderboardMember>>;
}

pub trait DataStore: RoomStore + UserStore + GoalStore + ActivityStore + Send + Sync {}
impl<T: RoomStore + UserStore + GoalStore + ActivityStore + Send + Sync> DataStore for T {}
