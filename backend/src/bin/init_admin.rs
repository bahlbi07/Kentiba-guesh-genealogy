#[path = "../auth.rs"]
mod auth;
#[path = "../db.rs"]
mod db;

use auth::hash_password;
use db::Database;
use std::env;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();

    let mut username = String::new();
    let mut password = String::new();

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--username" | "-u" => {
                if i + 1 < args.len() {
                    username = args[i + 1].clone();
                    i += 1;
                }
            }
            "--password" | "-p" => {
                if i + 1 < args.len() {
                    password = args[i + 1].clone();
                    i += 1;
                }
            }
            _ => {}
        }
        i += 1;
    }

    if username.is_empty() || password.is_empty() {
        eprintln!("Usage: cargo run --bin init_admin -- --username <user> --password <pass>");
        std::process::exit(1);
    }

    if password.len() < 8 {
        eprintln!("Error: Administrator password must be at least 8 characters long.");
        std::process::exit(1);
    }

    let db_path = env::var("DATABASE_PATH").unwrap_or_else(|_| "kinteba_genealogy.db".to_string());
    let db = Database::open(&db_path)?;

    println!("Hashing password using Argon2id with cryptographic salt...");
    let hashed = hash_password(&password).map_err(|e| format!("Hashing failed: {}", e))?;

    db.set_admin_user(&username, &hashed)?;

    println!("Successfully initialized administrator account '{}'!", username);
    println!("Database: '{}'", db_path);
    println!("Argon2id Hash: {}...[truncated]", &hashed[0..30]);

    Ok(())
}

