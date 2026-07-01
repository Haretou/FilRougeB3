# SafeLock — Explorateur de fichiers avec aperçu et édition

**Date :** 2026-07-01  
**Statut :** Approuvé

---

## Objectif

Remplacer les pages séparées (Récents, Favoris, Corbeille, Mes fichiers) par un **explorateur unifié à 3 colonnes** avec navigation par dossiers, aperçu de fichier et édition inline.

---

## Layout global — 3 colonnes

```
┌─────────────┬──────────────────────┬──────────────────────────┐
│  Sidebar     │  Liste fichiers       │  Panneau aperçu/édition  │
│  (existante) │  + breadcrumb         │                          │
│  ~64px       │  ~280px               │  flex:1                  │
└─────────────┴──────────────────────┴──────────────────────────┘
```

- La **sidebar** (nav, stockage, logout) reste inchangée.
- La **colonne liste** remplace le contenu principal actuel — breadcrumb en haut, liste de fichiers/dossiers cliquables, toolbar (+ Dossier, ↑ Upload, vue liste/grille).
- Le **panneau droit** s'affiche dès qu'un fichier est sélectionné. Vide avec placeholder si rien n'est sélectionné.

---

## Colonne liste — Navigation dossiers

- Cliquer sur un **dossier** : entre dans le dossier (charge `GET /api/files?parentId=<id>`), breadcrumb mis à jour.
- **Breadcrumb** : 🏠 › Dossier A › Sous-dossier B — chaque segment est cliquable pour remonter.
- Cliquer sur un **fichier** : le sélectionne (highlight border), panneau droit se met à jour.
- Toolbar : bouton `+ Dossier`, bouton `↑ Upload`, toggle vue liste/grille.

---

## Panneau droit — 3 onglets

### Onglet Aperçu

| Type de fichier | Rendu |
|---|---|
| Image (.jpg .png .gif .webp) | `<img>` responsive |
| Vidéo (.mp4 .webm .ogg) | `<video controls>` |
| PDF (.pdf) | `<iframe>` natif navigateur |
| Texte / code (.txt .md .js .py .json…) | `<pre>` avec contenu du fichier |
| Autre | Icône + nom + taille |

L'aperçu appelle `GET /api/files/:id/download` pour récupérer le blob, puis crée une object URL temporaire.

### Onglet Modifier

- **Fichiers texte/code** : `<textarea>` éditable avec le contenu du fichier. Bouton "Sauvegarder" appelle `PATCH /api/files/:id` avec le nouveau contenu (re-upload via `PUT /api/files/:id/content`).
- **Images** : canvas HTML5 avec 3 outils — Rotation (±90°), Recadrage (crop interactif), Filtre N&B. Bouton "Sauver" re-upload l'image transformée.
- **PDF / Vidéo / Autre** : onglet désactivé (greyed out).

### Onglet Infos

- Nom, taille, type MIME, date création, date modification.
- Champ "Renommer" éditable inline.

### Footer du panneau

Boutons permanents (sous les onglets) :
- `⬇ Télécharger` — déclenche le download natif
- `⭐ Favori` — toggle `PATCH /api/files/:id { isStarred }`
- `↗ Partager` — ouvre la modale de partage existante
- `🗑 Supprimer` — envoie en corbeille `DELETE /api/files/:id`

---

## Récents / Favoris / Corbeille

Ces 3 vues gardent leur route (`/dashboard/recent`, `/dashboard/favorites`, `/dashboard/trash`) mais utilisent le **même composant 3 colonnes**. Seule la liste change :

- **Récents** : `GET /api/files?filter=recent` — fichiers non-folder, triés par `updated_at DESC`, limit 20.
- **Favoris** : `GET /api/files?filter=starred`.
- **Corbeille** : `GET /api/files?filter=trash` — actions disponibles : Restaurer / Supprimer définitivement.

Pas de breadcrumb dans ces vues (liste plate, pas de navigation dossier).

---

## Nouveau endpoint nécessaire

`PUT /api/files/:id/content` — re-upload du contenu modifié (texte ou image transformée). Reçoit un FormData avec le fichier, remplace l'objet dans MinIO, met à jour `size_bytes` et `updated_at` en base.

---

## Architecture des composants

```
/dashboard/layout.tsx         — sidebar + header (inchangé)
/dashboard/_components/
  FileExplorer.tsx             — composant 3 colonnes partagé
  FileList.tsx                 — colonne liste + breadcrumb + toolbar
  FilePreviewPanel.tsx         — panneau droit avec 3 onglets
  editors/
    TextEditor.tsx             — textarea + sauvegarde
    ImageEditor.tsx            — canvas crop/rotate/N&B
/dashboard/page.tsx            — <FileExplorer filter="all" />
/dashboard/recent/page.tsx     — <FileExplorer filter="recent" />
/dashboard/favorites/page.tsx  — <FileExplorer filter="starred" />
/dashboard/trash/page.tsx      — <FileExplorer filter="trash" />
```

---

## Ce qui ne change pas

- Sidebar nav, stockage, logout — inchangés.
- API existante (`/api/files`, `/api/files/:id`, `/api/files/:id/download`, `/api/files/:id/share`) — utilisée telle quelle.
- Page mots de passe — inchangée.
- Styles CSS / Tailwind existants — on reste dans le même thème dark.
