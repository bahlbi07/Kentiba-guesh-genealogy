use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Hash a password using Argon2id with random salt
pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Argon2 hash error: {}", e))?
        .to_string();
    Ok(password_hash)
}

/// Verify a password against an Argon2id hash string
pub fn verify_password(password: &str, hash_str: &str) -> bool {
    if let Ok(parsed_hash) = PasswordHash::new(hash_str) {
        Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok()
    } else {
        false
    }
}

/// In-memory rate limiter for login protection
#[derive(Clone, Default)]
pub struct LoginRateLimiter {
    attempts: Arc<Mutex<HashMap<String, (u32, Instant)>>>,
}

impl LoginRateLimiter {
    pub fn new() -> Self {
        Self {
            attempts: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Returns true if allowed, false if rate limited (more than 5 attempts within 5 minutes)
    pub fn check_and_record(&self, key: &str, success: bool) -> bool {
        let mut map = self.attempts.lock().unwrap();
        let now = Instant::now();

        if success {
            map.remove(key);
            return true;
        }

        let entry = map.entry(key.to_string()).or_insert((0, now));
        if now.duration_since(entry.1) > Duration::from_secs(300) {
            *entry = (1, now);
            true
        } else {
            entry.0 += 1;
            entry.0 <= 5
        }
    }
}

/// In-memory active session token store
#[derive(Clone, Default)]
pub struct SessionStore {
    tokens: Arc<Mutex<HashMap<String, (String, Instant)>>>,
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            tokens: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn create_session(&self, username: &str) -> String {
        let token = uuid::Uuid::new_v4().to_string();
        let mut map = self.tokens.lock().unwrap();
        map.insert(token.clone(), (username.to_string(), Instant::now()));
        token
    }

    pub fn validate_session(&self, token: &str) -> Option<String> {
        let mut map = self.tokens.lock().unwrap();
        if let Some((username, created_at)) = map.get(token) {
            // Sessions expire after 8 hours
            if Instant::now().duration_since(*created_at) < Duration::from_secs(8 * 3600) {
                return Some(username.clone());
            } else {
                map.remove(token);
            }
        }
        None
    }

    pub fn invalidate_session(&self, token: &str) {
        let mut map = self.tokens.lock().unwrap();
        map.remove(token);
    }
}

