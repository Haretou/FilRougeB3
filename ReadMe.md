# SafeLock - Personal Digital Vault

A **zero-knowledge** cloud storage solution allowing individuals to store, synchronize, and share their sensitive files with full confidentiality.

## Principle

Files are **encrypted client-side** (AES-256-GCM) before being sent to the server. The encryption key is derived from the master password using **Argon2id**. The server never sees the data in plaintext — not even an administrator can access the content.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Client (Browser)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Interface    │  │  Crypto      │  │  Key       │ │
│  │  Next.js/React│  │  AES-256-GCM │  │  Derivation│ │
│  │               │  │              │  │  Argon2id  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬─────┘ │
│         │                 │                  │        │
└─────────┼─────────────────┼──────────────────┼───────┘
          │ HTTPS           │ Encrypted blobs  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────┐
│                Docker Infrastructure                  │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Backend      │  │  MySQL 8     │  │  MinIO     │ │
│  │  Next.js API  │  │  Encrypted   │  │  S3-compat.│ │
│  │  Port 3000    │  │  metadata    │  │  storage   │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│                                                       │
└─────────────────────────────────────────────────────┘
```

## Technical Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Frontend | Next.js 16 (React, TypeScript) | Modern framework, SSR, rich ecosystem |
| Backend | Next.js API Routes | Unified JS stack, simplified deployment |
| Database | MySQL 8 | Encrypted metadata, user management, DCL |
| File storage | MinIO (S3-compatible) | Encrypted blobs, self-hosted, resilient |
| Client-side crypto | Web Crypto API + Argon2id | AES-256-GCM encryption, key derivation |
| Infrastructure | Docker + Docker Compose | Containerization, network segmentation, zero-trust |
| Key derivation | Argon2id (hash-wasm) | Master key derivation from password |
| Sharing | RSA-OAEP 2048 (Web Crypto) | File key wrapping for a specific recipient |
| CI/CD | GitHub Actions | Automated linting, build, tests, dependency audit |
| SAST | CodeQL | Static application security testing |
| Logs / Audit | MySQL `audit_log` | Security event log (metadata only) |

## Team

| Member | Responsibilities |
|--------|-------------------|
| **Gaspard** | Frontend/Backend development, Digital forensics, Coordination |
| **Antoine** | Databases & NoSQL, DevOps (CI/CD, Docker), Pentesting, Backend co-development |
| **Raphael** | GRC (Information Security Policy, Risk Analysis), Incident management, BCP/DRP |

Documentation and project management are handled collectively by the whole team.

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (for local development)

### Run with Docker
```bash
docker compose up --build
```
The application will be available at `http://localhost:3000`.

### Local Development
```bash
npm install
npm run dev
```
> Encryption relies on the Web Crypto API, which is only available in a
> secure context: always access the app via `http://localhost:3000` (never
> via a raw IP address), otherwise key derivation will fail.

### Automated Tests
```bash
npm test     # tests for the cryptographic core (key derivation, AES-GCM, RSA sharing, recovery)
npm run lint # ESLint
```

## Features

- **Encrypted vault**: upload, preview, edit (text/image), and download files, end-to-end encrypted client-side (AES-256-GCM).
- **Password manager**: sensitive fields encrypted client-side.
- **Secure sharing**: share a file with another user via RSA-OAEP wrapping of the file key — only the recipient can decrypt it.
- **Account recovery**: a recovery code generated at sign-up allows vault recovery if the master password is forgotten (without ever exposing the key to the server).
- **Audit log**: traceability of security events (login, upload, share, deletion...) — metadata only, never the content itself.

## Project Structure

```
safelock/
├── src/
│   └── app/
│       ├── page.tsx              # Login/sign-up page
│       ├── layout.tsx            # Root layout
│       ├── globals.css           # SafeLock theme
│       └── dashboard/
│           ├── layout.tsx        # Dashboard layout (sidebar)
│           └── page.tsx          # "My files" view
├── db/
│   └── init/
│       └── 001-schema.sql       # Initial MySQL schema
├── docs/
│   └── PSSI.md                  # Security Policy (v1.0)
├── docker-compose.yml            # Service orchestration
├── Dockerfile                    # Multi-stage app build
└── README.md
```

## Target Competencies

- **GRC**: Information Security Policy, EBIOS RM risk analysis, treatment plan
- **Incident management**: Business Continuity/Disaster Recovery Plans, recovery procedures
- **Databases**: MySQL (DCL, backups), NoSQL (logs, audit)
- **Pentesting**: OWASP Top 10 audit, crypto testing, key management
- **DevOps**: Docker, GitHub Actions CI/CD, SAST, dependency scanning
- **Forensics**: Incident simulation, evidence collection, analysis

## Project Management

- **Version control**: Git / GitHub
- **Task tracking**: Trello
- **Communication**: Teams

Ynov Campus Montpellier - CYBER B3 - 2026
