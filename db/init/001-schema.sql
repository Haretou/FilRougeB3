-- SafeLock - Schema initial
-- Architecture zero-knowledge : le serveur ne stocke jamais de donnees en clair

CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name_encrypted BLOB NOT NULL,              -- Nom chiffre cote client
    master_password_hash VARCHAR(255) NOT NULL, -- Hash du hash (le client hash d'abord, le serveur re-hash)
    salt CHAR(64) NOT NULL,                     -- Salt pour la derivation de cle (Argon2id)
    recovery_key_hash VARCHAR(255),             -- Hash de la cle de recuperation
    encrypted_private_key BLOB,                 -- Cle privee chiffree par la master key
    public_key BLOB,                            -- Cle publique (pour le partage)
    storage_used_bytes BIGINT DEFAULT 0,
    storage_limit_bytes BIGINT DEFAULT 10737418240, -- 10 Go par defaut
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS files (
    id CHAR(36) PRIMARY KEY,
    owner_id CHAR(36) NOT NULL,
    parent_folder_id CHAR(36),                 -- NULL = racine
    name_encrypted BLOB NOT NULL,              -- Nom du fichier chiffre
    mime_type_encrypted BLOB,                  -- Type MIME chiffre
    size_bytes BIGINT NOT NULL,
    storage_key VARCHAR(255) NOT NULL,          -- Cle de reference dans MinIO
    file_key_encrypted BLOB NOT NULL,           -- Cle de chiffrement du fichier, chiffree par la master key
    iv CHAR(32) NOT NULL,                       -- Vecteur d'initialisation (AES-GCM)
    is_folder BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_folder_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS shared_files (
    id CHAR(36) PRIMARY KEY,
    file_id CHAR(36) NOT NULL,
    shared_by_id CHAR(36) NOT NULL,
    shared_with_id CHAR(36) NOT NULL,
    file_key_encrypted BLOB NOT NULL,          -- Cle du fichier re-chiffree avec la cle publique du destinataire
    permission ENUM('read', 'write') DEFAULT 'read',
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id CHAR(36),
    action VARCHAR(50) NOT NULL,               -- LOGIN, LOGOUT, UPLOAD, DOWNLOAD, SHARE, DELETE...
    resource_type VARCHAR(20),                  -- file, folder, share, session
    resource_id CHAR(36),
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS passwords (
    id CHAR(36) PRIMARY KEY,
    owner_id CHAR(36) NOT NULL,
    site_name VARCHAR(255) NOT NULL,
    username VARCHAR(255) DEFAULT '',
    password_value TEXT NOT NULL,
    url VARCHAR(500) DEFAULT '',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index pour les performances
CREATE INDEX idx_files_owner ON files(owner_id);
CREATE INDEX idx_files_parent ON files(parent_folder_id);
CREATE INDEX idx_shared_files_with ON shared_files(shared_with_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at);
