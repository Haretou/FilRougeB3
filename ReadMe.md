# SafeLock - Coffre-Fort Numerique Personnel

Solution de stockage cloud **zero-knowledge** permettant aux particuliers de stocker, synchroniser et partager leurs fichiers sensibles en toute confidentialite.

## Principe

Les fichiers sont **chiffres cote client** (AES-256-GCM) avant d'etre envoyes au serveur. La cle de chiffrement est derivee du mot de passe maitre via **Argon2id**. Le serveur ne voit jamais les donnees en clair — meme un administrateur ne peut pas acceder au contenu.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client (Navigateur)                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Interface    │  │  Crypto      │  │  Derivation│ │
│  │  Next.js/React│  │  AES-256-GCM │  │  Argon2id  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬─────┘ │
│         │                 │                  │        │
└─────────┼─────────────────┼──────────────────┼───────┘
          │ HTTPS           │ Blobs chiffres   │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────┐
│                 Infrastructure Docker                 │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Backend      │  │  MySQL 8     │  │  MinIO     │ │
│  │  Next.js API  │  │  Metadonnees │  │  Stockage  │ │
│  │  Port 3000    │  │  chiffrees   │  │  S3-compat │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│                                                       │
└─────────────────────────────────────────────────────┘
```

## Stack technique

| Composant | Technologie | Justification |
|-----------|------------|---------------|
| Frontend | Next.js 16 (React, TypeScript) | Framework moderne, SSR, ecosysteme riche |
| Backend | Next.js API Routes | Stack JS unifiee, simplification du deploiement |
| BDD | MySQL 8 | Metadonnees chiffrees, gestion utilisateurs, DCL |
| Stockage fichiers | MinIO (S3-compatible) | Blobs chiffres, auto-heberge, resilient |
| Crypto client | Web Crypto API + Argon2id | Chiffrement AES-256-GCM, derivation de cle |
| Infrastructure | Docker + Docker Compose | Containerisation, segmentation reseau, zero-trust |
| Derivation de cle | Argon2id (hash-wasm) | Derivation de la cle maitre depuis le mot de passe |
| Partage | RSA-OAEP 2048 (Web Crypto) | Enrobage des cles de fichiers pour un destinataire |
| CI/CD | GitHub Actions | Lint, build, tests automatises, audit de dependances |
| SAST | CodeQL | Analyse statique de securite du code |
| Logs / Audit | MySQL `audit_log` | Journal des evenements de securite (metadonnees only) |

## Equipe

| Membre | Responsabilites |
|--------|----------------|
| **Gaspard** | Developpement Frontend/Backend, Forensique numerique, Coordination |
| **Antoine** | BDD & NoSQL, DevOps (CI/CD, Docker), Pentesting, Co-developpement Backend |
| **Raphael** | GRC (PSSI, Analyse de risques), Gestion des incidents, PCA/PRA |

La documentation et la gestion de projet sont assurees par l'ensemble de l'equipe.

## Demarrage rapide

### Prerequis
- Docker et Docker Compose
- Node.js 20+ (pour le developpement local)

### Lancer avec Docker
```bash
docker compose up --build
```
L'application sera accessible sur `http://localhost:3000`.

### Developpement local
```bash
npm install
npm run dev
```
> Le chiffrement utilise l'API Web Crypto, disponible uniquement en contexte
> securise : accedez toujours a l'app via `http://localhost:3000` (jamais via une
> IP), sinon la derivation de cle echoue.

### Tests automatises
```bash
npm test     # tests du coeur cryptographique (derivation, AES-GCM, partage RSA, recuperation)
npm run lint # ESLint
```

## Fonctionnalites

- **Coffre-fort chiffre** : upload, apercu, edition (texte/image) et telechargement de fichiers, chiffres de bout en bout cote client (AES-256-GCM).
- **Gestionnaire de mots de passe** : champs sensibles chiffres cote client.
- **Partage securise** : partage d'un fichier a un autre utilisateur via enrobage RSA-OAEP de la cle du fichier — seul le destinataire peut le dechiffrer.
- **Recuperation de compte** : code de recuperation genere a l'inscription, permettant de retrouver son coffre en cas d'oubli du mot de passe maitre (sans jamais exposer la cle au serveur).
- **Journal d'audit** : tracabilite des evenements de securite (connexion, upload, partage, suppression...) — metadonnees uniquement, jamais le contenu.

## Structure du projet

```
safelock/
├── src/
│   └── app/
│       ├── page.tsx              # Page login/inscription
│       ├── layout.tsx            # Layout racine
│       ├── globals.css           # Theme SafeLock
│       └── dashboard/
│           ├── layout.tsx        # Layout dashboard (sidebar)
│           └── page.tsx          # Vue "Mes fichiers"
├── db/
│   └── init/
│       └── 001-schema.sql       # Schema MySQL initial
├── docs/
│   └── PSSI.md                  # Politique de Securite (v1.0)
├── docker-compose.yml            # Orchestration des services
├── Dockerfile                    # Build multi-stage de l'app
└── README.md
```

## Competences visees

- **GRC** : PSSI, analyse de risques EBIOS RM, plan de traitement
- **Gestion des incidents** : PCA/PRA, procedures de recuperation
- **BDD** : MySQL (DCL, sauvegardes), NoSQL (logs, audit)
- **Pentesting** : Audit OWASP Top 10, tests crypto, gestion de cles
- **DevOps** : Docker, CI/CD GitHub Actions, SAST, scan de dependances
- **Forensique** : Simulation d'incident, collecte de preuves, analyse

## Gestion de projet

- **Versionnement** : Git / GitHub
- **Suivi des taches** : Trello
- **Communication** : Teams


Ynov Campus Montpellier -  CYBER B3 - 2026
