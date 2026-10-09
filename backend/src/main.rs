mod auth;
mod db;
mod routes;

use auth::{LoginRateLimiter, SessionStore};
use axum::{
    http::{header, HeaderValue, Method},
    routing::{get, post},
    Router,
};
use db::Database;
use routes::AppState;
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting Kinteba Guush Genealogy Rust API Server...");

    let db_path = std::env::var("DATABASE_PATH").unwrap_or_else(|_| "kinteba_genealogy.db".to_string());
    let db = Database::open(&db_path)?;
    println!("Database initialized at '{}'", db_path);

    let state = AppState {
        db,
        sessions: SessionStore::new(),
        rate_limiter: LoginRateLimiter::new(),
    };

    // Configure Origin Allowlist (Section 2.3)
    // Supports explicit environment list or defaults to local development & Netlify
    let allowed_origins_env = std::env::var("ALLOWED_ORIGINS").unwrap_or_else(|_| {
        "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,https://kinteba-guush-genealogy.netlify.app".to_string()
    });

    let allowed_origins: Vec<HeaderValue> = allowed_origins_env
        .split(',')
        .filter_map(|s| s.trim().parse::<HeaderValue>().ok())
        .collect();

    println!("Allowed CORS Origins: {:?}", allowed_origins_env);

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, header::ACCEPT]);

    // Build router
    let app = Router::new()
        .route("/health", get(routes::health_check))
        .route("/api/health", get(routes::health_check))
        .route("/api/stats", get(routes::get_stats))
        .route("/api/people", get(routes::list_people))
        .route("/api/search", get(routes::search_people))
        .route("/api/relationships", get(routes::list_relationships))
        .route("/api/auth/login", post(routes::login))
        .route("/api/admin/audit", get(routes::get_audit_log))
        .layer(cors)
        .with_state(state);

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3001".to_string())
        .parse()
        .unwrap_or(3001);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Kinteba Guush API listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
