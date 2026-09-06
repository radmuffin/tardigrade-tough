use crate::models::*;
use crate::store::mappers::*;
use rusqlite::{params, Connection, Result};

pub fn get_user_personal_records(
    conn: &Connection,
    user_token: &str,
) -> Result<Vec<PersonalRecord>> {
    let mut stmt = conn.prepare(
        r#"SELECT 
            exercise_name,
            activity_type,
            MAX(weight_per_rep) AS max_weight,
            MAX(reps) AS max_reps,
            MAX(distance_val) AS max_distance,
            MAX(elevation_val) AS max_elevation
         FROM activities
         WHERE user_token = ? AND is_pr = 1 AND COALESCE(is_combined, 0) = 0
         GROUP BY LOWER(TRIM(exercise_name)), activity_type
         ORDER BY MAX(weight_per_rep) DESC, MAX(distance_val) DESC, MAX(elevation_val) DESC
         LIMIT 10"#,
    )?;

    let rows = stmt.query_map(params![user_token], map_personal_record)?;

    Ok(rows.filter_map(Result::ok).collect())
}
