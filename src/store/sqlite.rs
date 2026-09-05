use crate::models::*;
use crate::store::traits::*;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct SqliteStore {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteStore {
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }

    pub fn connection(&self) -> Arc<Mutex<Connection>> {
        self.conn.clone()
    }
}

impl RoomStore for SqliteStore {
    fn get_or_create_room(&self, slug: &str) -> StoreResult<Room> {
        let conn = self.conn.lock().unwrap();
        crate::db::get_or_create_room(&conn, slug).map_err(Into::into)
    }

    fn update_room_name(&self, slug: &str, new_name: &str) -> StoreResult<Room> {
        let conn = self.conn.lock().unwrap();
        crate::db::update_room_name(&conn, slug, new_name).map_err(Into::into)
    }

    fn ensure_room_member(&self, room_slug: &str, user_token: &str) -> StoreResult<()> {
        let conn = self.conn.lock().unwrap();
        crate::db::ensure_room_member(&conn, room_slug, user_token).map_err(Into::into)
    }

    fn get_room_members(&self, room_slug: &str) -> StoreResult<Vec<RoomMember>> {
        let conn = self.conn.lock().unwrap();
        crate::db::get_room_members(&conn, room_slug).map_err(Into::into)
    }

    fn leave_room(&self, room_slug: &str, user_token: &str) -> StoreResult<String> {
        let conn = self.conn.lock().unwrap();
        crate::db::leave_room(&conn, room_slug, user_token).map_err(Into::into)
    }

    fn remove_room_member(
        &self,
        room_slug: &str,
        creator_token: &str,
        target_token: &str,
    ) -> std::result::Result<String, String> {
        let conn = self.conn.lock().unwrap();
        crate::db::remove_room_member(&conn, room_slug, creator_token, target_token)
    }

    fn create_room_for_user(&self, user_token: &str, name: Option<&str>) -> StoreResult<Room> {
        let conn = self.conn.lock().unwrap();
        crate::db::create_room_for_user(&conn, user_token, name).map_err(Into::into)
    }

    fn get_user_squads(&self, user_token: &str) -> StoreResult<Vec<UserSquadSummary>> {
        let conn = self.conn.lock().unwrap();
        crate::db::get_user_squads(&conn, user_token).map_err(Into::into)
    }
}

impl UserStore for SqliteStore {
    fn get_user_current_room(&self, token: &str) -> StoreResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        crate::db::get_user_current_room(&conn, token).map_err(Into::into)
    }

    fn calculate_user_streak(&self, user_token: &str) -> (i32, String) {
        let conn = self.conn.lock().unwrap();
        crate::db::calculate_user_streak(&conn, user_token)
    }

    fn get_or_create_user(&self, token: &str, default_room: &str) -> StoreResult<UserProfile> {
        let conn = self.conn.lock().unwrap();
        crate::db::get_or_create_user(&conn, token, default_room).map_err(Into::into)
    }

    fn update_user_profile(
        &self,
        token: &str,
        req: &UpdateProfileRequest,
    ) -> StoreResult<UserProfile> {
        let conn = self.conn.lock().unwrap();
        crate::db::update_user_profile(&conn, token, req).map_err(Into::into)
    }

    fn get_user_personal_records(&self, user_token: &str) -> StoreResult<Vec<PersonalRecord>> {
        let conn = self.conn.lock().unwrap();
        crate::db::get_user_personal_records(&conn, user_token).map_err(Into::into)
    }
}

impl GoalStore for SqliteStore {
    fn get_goals_for_room(&self, room_slug: &str) -> StoreResult<(Vec<Goal>, Vec<Goal>)> {
        let conn = self.conn.lock().unwrap();
        crate::db::get_goals_for_room(&conn, room_slug).map_err(Into::into)
    }

    fn create_custom_goal(&self, room_slug: &str, req: &CreateGoalRequest) -> StoreResult<Goal> {
        let conn = self.conn.lock().unwrap();
        crate::db::create_custom_goal(&conn, room_slug, req).map_err(Into::into)
    }

    fn checkoff_goal(
        &self,
        user: &UserProfile,
        goal_id: i64,
        notes: Option<&str>,
    ) -> StoreResult<(Goal, Activity)> {
        let mut conn = self.conn.lock().unwrap();
        crate::db::checkoff_goal(&mut conn, user, goal_id, notes).map_err(Into::into)
    }

    fn create_goal_wishlist(
        &self,
        user_token: &str,
        req: &CreateGoalWishlistRequest,
    ) -> StoreResult<GoalWishlistItem> {
        let conn = self.conn.lock().unwrap();
        crate::db::create_goal_wishlist(&conn, user_token, req).map_err(Into::into)
    }

    fn get_wishlists(&self, room_slug: &str) -> StoreResult<Vec<GoalWishlistItem>> {
        let conn = self.conn.lock().unwrap();
        crate::db::get_wishlists(&conn, room_slug).map_err(Into::into)
    }
}

impl ActivityStore for SqliteStore {
    fn log_single_activity(
        &self,
        user: &UserProfile,
        target_room_slug: &str,
        req: &LogActivityRequest,
    ) -> StoreResult<Activity> {
        let mut conn = self.conn.lock().unwrap();
        crate::db::log_single_activity(&mut conn, user, target_room_slug, req).map_err(Into::into)
    }

    fn delete_activity(
        &self,
        activity_id: i64,
        user_token: &str,
    ) -> StoreResult<Option<Vec<String>>> {
        let mut conn = self.conn.lock().unwrap();
        crate::db::delete_activity(&mut conn, activity_id, user_token).map_err(Into::into)
    }

    fn get_recent_activities(&self, room_slug: &str, limit: i64) -> StoreResult<Vec<Activity>> {
        let conn = self.conn.lock().unwrap();
        crate::db::get_recent_activities(&conn, room_slug, limit).map_err(Into::into)
    }

    fn get_leaderboard(&self, room_slug: &str) -> StoreResult<Vec<LeaderboardMember>> {
        let conn = self.conn.lock().unwrap();
        crate::db::get_leaderboard(&conn, room_slug).map_err(Into::into)
    }
}
