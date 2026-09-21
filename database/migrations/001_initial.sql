-- Portable baseline: adapt UUID/boolean syntax to the selected production engine.
CREATE TABLE users (id VARCHAR(36) PRIMARY KEY, email VARCHAR(320) NOT NULL UNIQUE, password_hash TEXT NOT NULL, role VARCHAR(16) NOT NULL, created_at TIMESTAMP NOT NULL);
CREATE TABLE sessions (id VARCHAR(36) PRIMARY KEY, phone_number VARCHAR(32) NOT NULL UNIQUE, owner_user_id VARCHAR(36) NOT NULL, desired_state VARCHAR(16) NOT NULL, observed_state VARCHAR(16) NOT NULL, settings_version INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMP NOT NULL, FOREIGN KEY (owner_user_id) REFERENCES users(id));
CREATE TABLE commands (name VARCHAR(64) PRIMARY KEY, enabled BOOLEAN NOT NULL, metadata_json TEXT NOT NULL, updated_at TIMESTAMP NOT NULL);
CREATE TABLE settings (session_id VARCHAR(36) PRIMARY KEY, version INTEGER NOT NULL, settings_json TEXT NOT NULL, updated_at TIMESTAMP NOT NULL, FOREIGN KEY (session_id) REFERENCES sessions(id));
CREATE TABLE permissions (id VARCHAR(36) PRIMARY KEY, role VARCHAR(16) NOT NULL, capability VARCHAR(128) NOT NULL, UNIQUE(role, capability));
CREATE TABLE logs (id VARCHAR(36) PRIMARY KEY, actor_user_id VARCHAR(36), session_id VARCHAR(36), action VARCHAR(128) NOT NULL, metadata_json TEXT NOT NULL, created_at TIMESTAMP NOT NULL);
CREATE TABLE refresh_tokens (hash VARCHAR(128) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, expires_at TIMESTAMP NOT NULL, revoked_at TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
CREATE INDEX idx_logs_created_at ON logs(created_at);
CREATE INDEX idx_sessions_owner ON sessions(owner_user_id);
