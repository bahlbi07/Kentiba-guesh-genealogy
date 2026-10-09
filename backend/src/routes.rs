use crate::auth::{verify_password, LoginRateLimiter, SessionStore};
use crate::db::{AuditEventModel, Database, PersonModel, RelationshipModel};
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub sessions: SessionStore,
    pub rate_limiter: LoginRateLimiter,
}

#[derive(Deserialize)]
pub struct PaginationParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Deserialize)]
pub struct SearchParams {
    pub q: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Deserialize)]
pub struct LoginPayload {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub username: String,
}

#[derive(Serialize)]
pub struct StatsResponse {
    pub total_people: i64,
    pub total_relationships: i64,
    pub status: String,
}

// Helper to extract bearer token and authorize
fn authorize(headers: &HeaderMap, sessions: &SessionStore) -> Result<String, StatusCode> {
    if let Some(auth_header) = headers.get("authorization") {
        if let Ok(header_str) = auth_header.to_str() {
            if let Some(token) = header_str.strip_prefix("Bearer ") {
                if let Some(username) = sessions.validate_session(token) {
                    return Ok(username);
                }
            }
        }
    }
    Err(StatusCode::UNAUTHORIZED)
}

// Public: Health Check
pub async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "kinteba-guush-api",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

// Public: Database Stats
pub async fn get_stats(State(state): State<AppState>) -> impl IntoResponse {
    let people_count = state.db.get_people_count().unwrap_or(0);
    let rels_count = state.db.get_relationships_count().unwrap_or(0);

    Json(StatsResponse {
        total_people: people_count,
        total_relationships: rels_count,
        status: "operational".to_string(),
    })
}

// Public: List People (Paginated)
pub async fn list_people(
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(100).min(500);
    let offset = params.offset.unwrap_or(0);

    match state.db.get_all_people(limit, offset) {
        Ok(people) => (StatusCode::OK, Json(serde_json::json!(people))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        ),
    }
}

// Public: Search People across Tigrinya and English names
pub async fn search_people(
    State(state): State<AppState>,
    Query(params): Query<SearchParams>,
) -> impl IntoResponse {
    let query = params.q.unwrap_or_default();
    let limit = params.limit.unwrap_or(50).min(100);

    match state.db.search_people(&query, limit) {
        Ok(results) => (StatusCode::OK, Json(serde_json::json!(results))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        ),
    }
}

// Public: List All Relationships
pub async fn list_relationships(State(state): State<AppState>) -> impl IntoResponse {
    match state.db.get_all_relationships() {
        Ok(rels) => (StatusCode::OK, Json(serde_json::json!(rels))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        ),
    }
}

// Authentication Endpoint: Login with Rate Limiting & Argon2id
pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginPayload>,
) -> impl IntoResponse {
    let rate_key = format!("user:{}", payload.username);

    // Check rate limit
    if !state.rate_limiter.check_and_record(&rate_key, false) {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({ "error": "Too many failed attempts. Try again in 5 minutes." })),
        );
    }

    match state.db.get_admin_password_hash(&payload.username) {
        Ok(Some(hash)) => {
            if verify_password(&payload.password, &hash) {
                state.rate_limiter.check_and_record(&rate_key, true);
                let token = state.sessions.create_session(&payload.username);

                // Audit login
                let _ = state.db.insert_audit_event(&AuditEventModel {
                    id: format!("audit_{}", uuid::Uuid::new_v4()),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    entity_type: "auth".to_string(),
                    entity_id: payload.username.clone(),
                    action: "login".to_string(),
                    reviewer: payload.username.clone(),
                    details: "Successful administrator authentication".to_string(),
                });

                (
                    StatusCode::OK,
                    Json(serde_json::json!(LoginResponse {
                        token,
                        username: payload.username,
                    })),
                )
            } else {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(serde_json::json!({ "error": "Invalid username or password" })),
                )
            }
        }
        _ => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Invalid username or password" })),
        ),
    }
}

// Protected: Get Audit Log
pub async fn get_audit_log(
    headers: HeaderMap,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, StatusCode> {
    authorize(&headers, &state.sessions)?;

    match state.db.get_audit_events(100) {
        Ok(events) => Ok((StatusCode::OK, Json(serde_json::json!(events)))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

