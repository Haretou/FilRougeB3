-- 002-contacts.sql
CREATE TABLE IF NOT EXISTS contacts (
  id         CHAR(36)     NOT NULL,
  owner_id   CHAR(36)     NOT NULL,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_contacts_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_owner_email (owner_id, email)
);

CREATE INDEX idx_contacts_owner ON contacts(owner_id);
