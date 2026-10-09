mod auth;
mod db;
mod routes;

use auth::{LoginRateLimiter, SessionStore};
use axum::{
    routing::{get, post},
    Router,
};
use db::Database;
use routes::AppState;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};

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

    // Configure secure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router
    let app = Router::new()
        .route("/health", get(routes::health_check))
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

