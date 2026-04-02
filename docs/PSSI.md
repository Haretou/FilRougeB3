# Politique de Securite des Systemes d'Information (PSSI)

## Projet : SafeLock - Coffre-Fort Numerique Personnel

---

**Version** : 1.0  
**Date** : 26 janvier 2026  
**Auteur** : Raphael (GRC Lead)  
**Statut** : Version initiale  
**Classification** : Interne

---

## 1. Introduction et contexte

### 1.1 Objet du document

La presente PSSI definit le cadre formel et les exigences de securite pour le projet SafeLock. Elle constitue le socle de la gouvernance securite et s'applique a l'ensemble des ressources humaines, techniques et informationnelles du projet.

### 1.2 Perimetre

Cette politique couvre :
- L'application web SafeLock (frontend et backend)
- L'infrastructure Docker (conteneurs, reseaux, volumes)
- Les bases de donnees (MySQL, NoSQL)
- Le stockage objets (MinIO)
- Les processus de developpement et de deploiement (CI/CD)
- La gestion des acces et des cles cryptographiques

### 1.3 Public cible

- Equipe de developpement (Gaspard, Antoine)
- Responsable GRC (Raphael)
- Tout intervenant futur sur le projet

---

## 2. Principes fondamentaux de securite

### 2.1 Architecture Zero-Knowledge

**Principe** : Le serveur ne doit jamais avoir acces aux donnees en clair des utilisateurs.

**Implementation** :
- Le chiffrement et le dechiffrement s'effectuent exclusivement cote client (navigateur)
- La cle de chiffrement est derivee du mot de passe maitre via Argon2id
- Le mot de passe maitre n'est jamais transmis au serveur (seul un hash du hash est envoye)
- Les metadonnees des fichiers (noms, types) sont elles aussi chiffrees cote client

**Consequence** : En cas de compromission du serveur ou de la base de donnees, l'attaquant n'obtient que des donnees chiffrees inexploitables sans le mot de passe maitre.

### 2.2 Defense en profondeur

Plusieurs couches de securite sont mises en place :

| Couche | Mesure |
|--------|--------|
| Reseau | Segmentation Docker, HTTPS obligatoire, pare-feu applicatif |
| Application | Validation des entrees, protection CSRF/XSS, rate limiting |
| Authentification | Hash Argon2id, sessions securisees, expiration automatique |
| Donnees | Chiffrement AES-256-GCM, IV uniques, cles par fichier |
| Infrastructure | Conteneurs isoles, privileges minimaux, images minimales |

### 2.3 Moindre privilege

- Chaque service Docker s'execute avec les droits minimaux necessaires
- L'utilisateur MySQL applicatif n'a acces qu'aux operations requises (pas de DROP, pas de GRANT)
- Les conteneurs n'ont pas d'acces root
- Les secrets ne sont jamais codes en dur dans le code source

### 2.4 Separation des responsabilites

- Le frontend gere la cryptographie et l'interface utilisateur
- Le backend gere l'authentification, les metadonnees et le routage vers le stockage
- La base de donnees stocke uniquement des donnees chiffrees ou des metadonnees non sensibles
- Le stockage objets contient uniquement des blobs chiffres

---

## 3. Politique cryptographique

### 3.1 Algorithmes autorises

| Usage | Algorithme | Parametres |
|-------|-----------|------------|
| Chiffrement des fichiers | AES-256-GCM | Cle 256 bits, IV 96 bits unique par operation |
| Derivation de cle | Argon2id | Memoire : 64 Mo, Iterations : 3, Parallelisme : 4 |
| Hash mot de passe (serveur) | bcrypt | Cost factor : 12 |
| Chiffrement asymetrique (partage) | RSA-OAEP | 4096 bits |
| Hash d'integrite | SHA-256 | Standard |

### 3.2 Gestion des cles

- **Master Key** : Derivee du mot de passe maitre, jamais stockee, jamais transmise
- **File Key** : Cle AES-256 unique par fichier, chiffree par la Master Key et stockee en BDD
- **Key Pair (RSA)** : Cle privee chiffree par la Master Key, cle publique en clair (pour le partage)
- **Recovery Key** : Generee a l'inscription, communiquee une seule fois a l'utilisateur, hash stocke en BDD

### 3.3 Rotation des cles

- Les cles de fichier ne sont pas reutilisees entre fichiers
- Un IV unique est genere pour chaque operation de chiffrement
- En cas de changement de mot de passe, toutes les File Keys sont re-chiffrees avec la nouvelle Master Key

---

## 4. Politique d'authentification et de controle d'acces

### 4.1 Authentification

- Mot de passe maitre : minimum 12 caracteres, complexite verifiee cote client
- Le client effectue un premier hash (PBKDF2 ou Argon2id) avant envoi
- Le serveur re-hash avec bcrypt avant stockage
- Sessions avec token JWT signe, expiration 24h, renouvellement par refresh token
- Verrouillage du compte apres 5 tentatives echouees (delai progressif)

### 4.2 Controle d'acces (DCL)

Les roles MySQL suivants sont definis :

| Role | Droits | Usage |
|------|--------|-------|
| `safelock_app` | SELECT, INSERT, UPDATE, DELETE sur tables applicatives | Backend applicatif |
| `safelock_readonly` | SELECT uniquement | Monitoring, audit |
| `safelock_admin` | Tous droits (usage restreint) | Maintenance, migrations |

### 4.3 Gestion des sessions

- Tokens stockes en cookies HttpOnly, Secure, SameSite=Strict
- Revocation de session a la deconnexion
- Liste des sessions actives accessible a l'utilisateur
- Journalisation de chaque connexion (IP, User-Agent, horodatage)

---

## 5. Politique de journalisation et d'audit

### 5.1 Evenements journalises

Tous les evenements suivants sont consignes dans la table `audit_log` et/ou la base NoSQL :

- Connexions et deconnexions (succes et echecs)
- Uploads et downloads de fichiers
- Partages et revocations de partage
- Modifications de mot de passe
- Tentatives d'acces non autorisees
- Erreurs applicatives

### 5.2 Conservation

- Logs applicatifs : conservation 90 jours minimum
- Logs d'audit securite : conservation 1 an
- Les logs ne contiennent jamais de donnees utilisateur en clair

### 5.3 Acces aux logs

- Les logs sont accessibles uniquement au role `safelock_readonly` et a l'equipe operationnelle
- Toute consultation des logs est elle-meme journalisee

---

## 6. Politique de sauvegarde

### 6.1 Strategie de sauvegarde

| Donnee | Frequence | Retention | Methode |
|--------|-----------|-----------|---------|
| Base MySQL | Quotidienne | 30 jours | mysqldump chiffre |
| Stockage MinIO | Continue (replication) | - | Replication MinIO |
| Configuration Docker | A chaque modification | Historique Git | Versionnement |

### 6.2 Securite des sauvegardes

- Les sauvegardes MySQL sont chiffrees avant stockage
- Les donnees utilisateurs dans les sauvegardes sont deja chiffrees (zero-knowledge)
- Tests de restauration : trimestriels

---

## 7. Conformite RGPD

### 7.1 Donnees personnelles traitees

| Donnee | Base legale | Finalite |
|--------|------------|----------|
| Email | Execution du contrat | Identification, recuperation de compte |
| Nom (chiffre) | Execution du contrat | Personnalisation de l'interface |
| Adresse IP (logs) | Interet legitime | Securite, detection d'intrusion |
| Fichiers (chiffres) | Execution du contrat | Service de stockage |

### 7.2 Droits des utilisateurs

- **Acces** : L'utilisateur a acces a toutes ses donnees via l'interface
- **Rectification** : Modification possible de toutes les donnees personnelles
- **Suppression** : Suppression du compte et de toutes les donnees associees
- **Portabilite** : Export de tous les fichiers dechiffres via l'interface
- **Limitation** : Possibilite de geler le compte

### 7.3 Privacy by Design

L'architecture zero-knowledge constitue la mesure de protection la plus forte : les donnees sont inintelligibles pour quiconque n'est pas l'utilisateur proprietaire, y compris l'hebergeur et l'equipe de developpement.

---

## 8. Gestion des incidents

### 8.1 Classification des incidents

| Niveau | Description | Exemple | Delai de reaction |
|--------|-------------|---------|-------------------|
| P1 - Critique | Compromission confirmee de donnees | Fuite de base, acces non autorise | < 1 heure |
| P2 - Majeur | Service indisponible ou degrade | Crash serveur, DDoS | < 4 heures |
| P3 - Mineur | Anomalie sans impact donnees | Bug UI, lenteur | < 24 heures |
| P4 - Information | Evenement a surveiller | Tentatives de connexion echouees | Prochain jour ouvre |

### 8.2 Processus de reponse

1. **Detection** : Monitoring des logs, alertes automatiques
2. **Qualification** : Evaluation de l'impact et classification
3. **Confinement** : Isolation du composant affecte
4. **Eradication** : Correction de la vulnerabilite
5. **Recuperation** : Restauration du service
6. **Retour d'experience** : Analyse post-mortem, mise a jour de la PSSI

Voir le document PCA/PRA (a venir) pour les procedures detaillees.

---

## 9. Analyse de risques (synthese)

Une analyse de risques detaillee est en cours (approche EBIOS RM). Voici les principaux scenarios identifies :

| Scenario | Vraisemblance | Impact | Risque | Mesure principale |
|----------|--------------|--------|--------|-------------------|
| Compromission du serveur | Moyenne | Faible (zero-knowledge) | Faible | Chiffrement E2E, segmentation |
| Vol du device utilisateur | Elevee | Moyen | Moyen | Expiration de session, verrouillage |
| Perte du mot de passe maitre | Elevee | Eleve | Eleve | Cle de recuperation |
| Attaque brute-force | Moyenne | Moyen | Moyen | Argon2id, rate limiting, verrouillage |
| Injection SQL | Faible | Moyen | Faible | ORM, requetes parametrees, DCL |
| XSS / CSRF | Moyenne | Moyen | Moyen | CSP, tokens CSRF, HttpOnly cookies |
| Attaque side-channel sur la crypto | Faible | Eleve | Moyen | Web Crypto API (implementation native) |

---

## 10. Revisions et approbation

| Version | Date | Auteur | Modifications |
|---------|------|--------|--------------|
| 1.0 | 26 jan. 2026 | Raphael | Creation initiale |

**Prochaine revision prevue** : Avril 2026 (post oral intermediaire)

---

*Ce document est versionne dans le depot Git du projet et fait l'objet de revisions regulieres.*
