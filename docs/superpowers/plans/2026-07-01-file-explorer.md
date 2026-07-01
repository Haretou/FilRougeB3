# File Explorer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les pages Récents/Favoris/Corbeille/Mes fichiers par un explorateur unifié à 3 colonnes avec navigation dossiers, aperçu de fichier inline et édition de texte/images.

**Architecture:** Composant partagé `FileExplorer` qui combine `FileList` (colonne centrale avec breadcrumb et navigation dossiers) et `FilePreviewPanel` (panneau droit avec onglets Aperçu/Modifier/Infos). Chaque page dashboard instancie `FileExplorer` avec un `filter` prop différent. Un nouvel endpoint `PUT /api/files/[id]/content` permet de re-uploader le contenu modifié.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, Tailwind CSS, @aws-sdk/client-s3 (MinIO), HTML5 Canvas (image editor), lucide-react

---

## File Structure

```
src/
  app/
    api/
      files/
        [id]/
          content/
            route.ts          ← NEW: PUT re-upload content
    dashboard/
      _components/
        FileExplorer.tsx      ← NEW: layout 3 colonnes + état partagé
        FileList.tsx          ← NEW: breadcrumb + liste fichiers cliquables
        FilePreviewPanel.tsx  ← NEW: panneau droit 3 onglets + footer
        editors/
          TextEditor.tsx      ← NEW: textarea + sauvegarde
          ImageEditor.tsx     ← NEW: canvas rotation/crop/N&B
      page.tsx                ← MODIFY: use FileExplorer
      recent/page.tsx         ← MODIFY: use FileExplorer filter="recent"
      favorites/page.tsx      ← MODIFY: use FileExplorer filter="starred"
      trash/page.tsx          ← MODIFY: use FileExplorer filter="trash"
```

---

## Task 1: API — PUT /api/files/[id]/content

Re-upload the content of an existing file (text or image). Replaces the object in MinIO and updates `size_bytes` in DB.

**Files:**
- Create: `src/app/api/files/[id]/content/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/files/[id]/content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import db from '@/lib/db';
import { s3, BUCKET } from '@/lib/minio';
import { getSessionUser } from '@/lib/session';

export const maxDuration = 60;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;

  // Verify ownership and get storage_key
  const [rows] = await db.execute<any[]>(
    'SELECT storage_key, size_bytes FROM files WHERE id = ? AND owner_id = ? AND is_deleted = FALSE AND is_folder = FALSE',
    [id, user.id]
  );
  if (!rows.length) {
    return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
  }
  const { storage_key, size_bytes: oldSize } = rows[0];

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: storage_key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
      ContentLength: buffer.length,
    })
  );

  const sizeDiff = buffer.length - Number(oldSize);
  await db.execute('UPDATE files SET size_bytes = ?, updated_at = NOW() WHERE id = ?', [buffer.length, id]);
  await db.execute(
    'UPDATE users SET storage_used_bytes = GREATEST(0, storage_used_bytes + ?) WHERE id = ?',
    [sizeDiff, user.id]
  );

  return NextResponse.json({ ok: true, sizeBytes: buffer.length });
}
```

- [ ] **Step 2: Vérifier manuellement dans le navigateur**

Ouvrir DevTools → Network, uploader un fichier texte puis appeler :
```
PUT http://localhost:3001/api/files/<id>/content
Body: FormData { file: new Blob(['hello world'], {type: 'text/plain'}) }
```
Réponse attendue : `{ ok: true, sizeBytes: 11 }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/files/[id]/content/route.ts
git commit -m "feat: add PUT /api/files/[id]/content to re-upload file content"
```

---

## Task 2: TextEditor component

Éditeur de texte/code qui charge le contenu du fichier, affiche un textarea éditable et sauvegarde via PUT /api/files/[id]/content.

**Files:**
- Create: `src/app/dashboard/_components/editors/TextEditor.tsx`

- [ ] **Step 1: Create TextEditor**

```typescript
// src/app/dashboard/_components/editors/TextEditor.tsx
"use client";

import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";

interface Props {
  fileId: string;
  fileName: string;
  onSaved?: () => void;
}

export default function TextEditor({ fileId, fileName, onSaved }: Props) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    setLoading(true);
    setContent("");
    setMsg(null);
    fetch(`/api/files/${fileId}/download`)
      .then((r) => r.text())
      .then((text) => setContent(text))
      .catch(() => setContent(""))
      .finally(() => setLoading(false));
  }, [fileId]);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const blob = new Blob([content], { type: "text/plain" });
      const fd = new FormData();
      fd.append("file", blob, fileName);
      const res = await fetch(`/api/files/${fileId}/content`, { method: "PUT", body: fd });
      if (res.ok) {
        setMsg({ text: "Sauvegardé !", ok: true });
        onSaved?.();
      } else {
        setMsg({ text: "Erreur lors de la sauvegarde", ok: false });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Chargement...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card shrink-0">
        <span className="text-xs text-muted font-mono">{fileName}</span>
        <div className="flex items-center gap-2">
          {msg && (
            <span className={`text-xs ${msg.ok ? "text-success" : "text-danger"}`}>
              {msg.text}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs px-3 py-1.5 rounded-md transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Sauvegarder
          </button>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 w-full bg-background text-foreground font-mono text-sm p-4 resize-none focus:outline-none"
        spellCheck={false}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/_components/editors/TextEditor.tsx
git commit -m "feat: add TextEditor component with load and save"
```

---

## Task 3: ImageEditor component

Éditeur d'image avec canvas HTML5 : rotation ±90°, filtre N&B, recadrage par coordonnées. Sauvegarde via PUT /api/files/[id]/content.

**Files:**
- Create: `src/app/dashboard/_components/editors/ImageEditor.tsx`

- [ ] **Step 1: Create ImageEditor**

```typescript
// src/app/dashboard/_components/editors/ImageEditor.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RotateCcw, RotateCw, Crop, CircleHalf, Save, Loader2, RefreshCw } from "lucide-react";

interface Props {
  fileId: string;
  fileName: string;
  mimeType: string;
  onSaved?: () => void;
}

export default function ImageEditor({ fileId, fileName, mimeType, onSaved }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [grayscale, setGrayscale] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100, enabled: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Load image blob
  useEffect(() => {
    setLoading(true);
    setRotation(0);
    setGrayscale(false);
    setCrop({ x: 0, y: 0, w: 100, h: 100, enabled: false });
    setMsg(null);
    fetch(`/api/files/${fileId}/download`)
      .then((r) => r.blob())
      .then((blob) => setOriginalSrc(URL.createObjectURL(blob)))
      .catch(() => setOriginalSrc(null))
      .finally(() => setLoading(false));
    return () => { if (originalSrc) URL.revokeObjectURL(originalSrc); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  // Draw to canvas whenever state changes
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !originalSrc) return;
    const img = new Image();
    img.onload = () => {
      const rad = (rotation * Math.PI) / 180;
      const swap = rotation === 90 || rotation === 270;
      const cw = swap ? img.height : img.width;
      const ch = swap ? img.width : img.height;
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d")!;
      ctx.save();
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      if (grayscale) {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < data.data.length; i += 4) {
          const avg = (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3;
          data.data[i] = data.data[i + 1] = data.data[i + 2] = avg;
        }
        ctx.putImageData(data, 0, 0);
      }
    };
    img.src = originalSrc;
  }, [originalSrc, rotation, grayscale]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  const rotate = (dir: 1 | -1) => setRotation((r) => (r + dir * 90 + 360) % 360);

  const applyCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const px = (v: number, total: number) => Math.round((v / 100) * total);
    const x = px(crop.x, canvas.width);
    const y = px(crop.y, canvas.height);
    const w = px(crop.w, canvas.width);
    const h = px(crop.h, canvas.height);
    const imgData = ctx.getImageData(x, y, w, h);
    canvas.width = w;
    canvas.height = h;
    ctx.putImageData(imgData, 0, 0);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setMsg(null);
    canvas.toBlob(async (blob) => {
      if (!blob) { setSaving(false); return; }
      const fd = new FormData();
      fd.append("file", blob, fileName);
      const res = await fetch(`/api/files/${fileId}/content`, { method: "PUT", body: fd });
      setSaving(false);
      if (res.ok) {
        setMsg({ text: "Image sauvegardée !", ok: true });
        onSaved?.();
      } else {
        setMsg({ text: "Erreur lors de la sauvegarde", ok: false });
      }
    }, mimeType, 0.92);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Chargement...
      </div>
    );
  }

  if (!originalSrc) {
    return <div className="flex items-center justify-center h-full text-muted text-sm">Impossible de charger l&apos;image.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0 flex-wrap">
        <button onClick={() => rotate(-1)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted hover:text-foreground bg-background border border-border rounded-md transition-all">
          <RotateCcw className="w-3.5 h-3.5" /> -90°
        </button>
        <button onClick={() => rotate(1)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted hover:text-foreground bg-background border border-border rounded-md transition-all">
          <RotateCw className="w-3.5 h-3.5" /> +90°
        </button>
        <button
          onClick={() => setGrayscale((g) => !g)}
          className={`flex items-center gap-1 px-2 py-1.5 text-xs border rounded-md transition-all ${grayscale ? "bg-primary/10 text-primary border-primary/30" : "text-muted hover:text-foreground bg-background border-border"}`}
        >
          <CircleHalf className="w-3.5 h-3.5" /> N&amp;B
        </button>
        <button onClick={() => setCrop((c) => ({ ...c, enabled: !c.enabled }))}
          className={`flex items-center gap-1 px-2 py-1.5 text-xs border rounded-md transition-all ${crop.enabled ? "bg-primary/10 text-primary border-primary/30" : "text-muted hover:text-foreground bg-background border-border"}`}>
          <Crop className="w-3.5 h-3.5" /> Recadrer
        </button>
        <button onClick={() => { setRotation(0); setGrayscale(false); setCrop({ x: 0, y: 0, w: 100, h: 100, enabled: false }); }}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted hover:text-foreground bg-background border border-border rounded-md transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Reset
        </button>
        <div className="flex-1" />
        {msg && <span className={`text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span>}
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs px-3 py-1.5 rounded-md transition-all disabled:opacity-50">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Sauver
        </button>
      </div>

      {/* Crop controls */}
      {crop.enabled && (
        <div className="flex items-center gap-3 px-3 py-2 bg-primary/5 border-b border-primary/20 text-xs text-muted flex-wrap shrink-0">
          <span className="text-primary font-medium">Recadrage (%) :</span>
          {(["x", "y", "w", "h"] as const).map((k) => (
            <label key={k} className="flex items-center gap-1">
              <span className="uppercase font-mono">{k}</span>
              <input type="number" min={0} max={100} value={crop[k]}
                onChange={(e) => setCrop((c) => ({ ...c, [k]: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                className="w-14 bg-background border border-border rounded px-1.5 py-0.5 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </label>
          ))}
          <button onClick={applyCrop}
            className="bg-primary text-white px-2 py-0.5 rounded text-xs">
            Appliquer
          </button>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-background p-4">
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain rounded shadow" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/_components/editors/ImageEditor.tsx
git commit -m "feat: add ImageEditor with canvas rotation, grayscale and crop"
```

---

## Task 4: FilePreviewPanel component

Panneau droit avec 3 onglets (Aperçu, Modifier, Infos) et footer d'actions (Download, Favori, Partager, Supprimer).

**Files:**
- Create: `src/app/dashboard/_components/FilePreviewPanel.tsx`

- [ ] **Step 1: Create FilePreviewPanel**

```typescript
// src/app/dashboard/_components/FilePreviewPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { Download, Star, Share2, Trash2, X, Lock, Loader2, FileText, Image, Film, FileArchive } from "lucide-react";
import TextEditor from "./editors/TextEditor";
import ImageEditor from "./editors/ImageEditor";

interface VaultFile {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number;
  isFolder: boolean;
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  file: VaultFile;
  onClose: () => void;
  onStarToggle: (file: VaultFile) => void;
  onDelete: (fileId: string) => void;
  onShare: (file: VaultFile) => void;
  onSaved: () => void;
  isTrash?: boolean;
  onRestore?: (fileId: string) => void;
}

type Tab = "apercu" | "modifier" | "infos";

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} Ko`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} Mo`;
  return `${(bytes / 1_073_741_824).toFixed(2)} Go`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function isText(mime: string | null) {
  if (!mime) return false;
  return mime.startsWith("text/") || ["application/json", "application/javascript", "application/typescript", "application/xml"].some((m) => mime.includes(m)) || ["js", "ts", "py", "java", "c", "cpp", "md", "yaml", "yml", "toml", "sh"].some((ext) => mime.includes(ext));
}

function isImage(mime: string | null) {
  return !!mime?.startsWith("image/");
}

function isVideo(mime: string | null) {
  return !!mime?.startsWith("video/");
}

function isPdf(mime: string | null) {
  return mime === "application/pdf";
}

function canEdit(mime: string | null) {
  return isText(mime) || isImage(mime);
}

export default function FilePreviewPanel({ file, onClose, onStarToggle, onDelete, onShare, onSaved, isTrash, onRestore }: Props) {
  const [tab, setTab] = useState<Tab>("apercu");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [newName, setNewName] = useState(file.name);
  const [renaming, setRenaming] = useState(false);

  // Reset when file changes
  useEffect(() => {
    setTab("apercu");
    setPreviewUrl(null);
    setPreviewText(null);
    setNewName(file.name);
  }, [file.id, file.name]);

  // Load preview for apercu tab
  useEffect(() => {
    if (tab !== "apercu") return;
    if (file.isFolder) return;

    setLoadingPreview(true);
    if (isText(file.mimeType)) {
      fetch(`/api/files/${file.id}/download`)
        .then((r) => r.text())
        .then(setPreviewText)
        .catch(() => setPreviewText(null))
        .finally(() => setLoadingPreview(false));
    } else if (isImage(file.mimeType) || isVideo(file.mimeType) || isPdf(file.mimeType)) {
      fetch(`/api/files/${file.id}/download`)
        .then((r) => r.blob())
        .then((blob) => setPreviewUrl(URL.createObjectURL(blob)))
        .catch(() => setPreviewUrl(null))
        .finally(() => setLoadingPreview(false));
    } else {
      setLoadingPreview(false);
    }

    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, tab]);

  const handleDownload = async () => {
    const res = await fetch(`/api/files/${file.id}/download`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = file.name; a.click();
    URL.revokeObjectURL(url);
  };

  const handleRename = async () => {
    if (newName === file.name || !newName.trim()) return;
    setRenaming(true);
    await fetch(`/api/files/${file.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setRenaming(false);
    onSaved();
  };

  const fileTypeIcon = () => {
    if (isImage(file.mimeType)) return <Image className="w-8 h-8 text-emerald-400" />;
    if (isVideo(file.mimeType)) return <Film className="w-8 h-8 text-purple-400" />;
    if (file.mimeType?.includes("zip") || file.mimeType?.includes("tar")) return <FileArchive className="w-8 h-8 text-amber-400" />;
    return <FileText className="w-8 h-8 text-blue-400" />;
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Lock className="w-3 h-3 text-success" />
            <span className="text-xs text-success">Chiffré AES-256</span>
          </div>
        </div>
        <button onClick={onClose} className="text-muted hover:text-foreground shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-card shrink-0">
        {(["apercu", "modifier", "infos"] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = { apercu: "👁 Aperçu", modifier: "✏️ Modifier", infos: "ℹ️ Infos" };
          const disabled = t === "modifier" && !canEdit(file.mimeType);
          return (
            <button
              key={t}
              onClick={() => !disabled && setTab(t)}
              className={`px-4 py-2.5 text-xs font-medium transition-all border-b-2 ${
                tab === t
                  ? "text-primary border-primary"
                  : disabled
                  ? "text-muted/40 border-transparent cursor-not-allowed"
                  : "text-muted border-transparent hover:text-foreground"
              }`}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto min-h-0">
        {/* APERCU */}
        {tab === "apercu" && (
          <div className="h-full flex flex-col items-center justify-center">
            {loadingPreview && (
              <div className="flex items-center gap-2 text-muted text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
              </div>
            )}
            {!loadingPreview && isImage(file.mimeType) && previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={file.name} className="max-w-full max-h-full object-contain p-4" />
            )}
            {!loadingPreview && isVideo(file.mimeType) && previewUrl && (
              <video src={previewUrl} controls className="max-w-full max-h-full p-4" />
            )}
            {!loadingPreview && isPdf(file.mimeType) && previewUrl && (
              <iframe src={previewUrl} className="w-full h-full border-0" title={file.name} />
            )}
            {!loadingPreview && isText(file.mimeType) && previewText !== null && (
              <pre className="w-full h-full overflow-auto p-4 text-xs text-foreground font-mono whitespace-pre-wrap">
                {previewText}
              </pre>
            )}
            {!loadingPreview && !isImage(file.mimeType) && !isVideo(file.mimeType) && !isPdf(file.mimeType) && !isText(file.mimeType) && (
              <div className="text-center text-muted">
                {fileTypeIcon()}
                <p className="mt-3 text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs mt-1">{formatSize(file.sizeBytes)}</p>
                <p className="text-xs mt-0.5">Aucun aperçu disponible</p>
              </div>
            )}
          </div>
        )}

        {/* MODIFIER */}
        {tab === "modifier" && canEdit(file.mimeType) && (
          <div className="h-full">
            {isText(file.mimeType) ? (
              <TextEditor fileId={file.id} fileName={file.name} onSaved={onSaved} />
            ) : isImage(file.mimeType) ? (
              <ImageEditor fileId={file.id} fileName={file.name} mimeType={file.mimeType!} onSaved={onSaved} />
            ) : null}
          </div>
        )}

        {/* INFOS */}
        {tab === "infos" && (
          <div className="p-4 space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted">Taille</span>
                <span className="text-foreground font-medium">{formatSize(file.sizeBytes)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted">Type</span>
                <span className="text-foreground font-medium">{file.mimeType ?? "Inconnu"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted">Créé le</span>
                <span className="text-foreground">{formatDate(file.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted">Modifié le</span>
                <span className="text-foreground">{formatDate(file.updatedAt)}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5 font-medium uppercase tracking-wider">Renommer</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRename()}
                  className="flex-1 bg-background border border-border rounded-lg py-2 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  onClick={handleRename}
                  disabled={renaming || newName === file.name}
                  className="bg-primary hover:bg-primary-hover text-white text-xs px-3 py-2 rounded-lg transition-all disabled:opacity-50"
                >
                  {renaming ? <Loader2 className="w-3 h-3 animate-spin" /> : "OK"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-3 py-3 border-t border-border bg-card shrink-0">
        {isTrash ? (
          <div className="flex gap-2">
            <button onClick={() => onRestore?.(file.id)}
              className="flex-1 bg-primary hover:bg-primary-hover text-white text-xs py-2 rounded-lg transition-all font-medium">
              ↩ Restaurer
            </button>
            <button onClick={() => onDelete(file.id)}
              className="flex-1 bg-danger/10 hover:bg-danger/20 text-danger text-xs py-2 rounded-lg transition-all font-medium">
              🗑 Suppr. définitif
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs py-2 rounded-lg transition-all">
              <Download className="w-3.5 h-3.5" /> Télécharger
            </button>
            <button onClick={() => onStarToggle(file)}
              className={`p-2 rounded-lg border transition-all ${file.isStarred ? "bg-amber-400/10 border-amber-400/30 text-amber-400" : "bg-background border-border text-muted hover:text-foreground"}`}>
              <Star className={`w-4 h-4 ${file.isStarred ? "fill-amber-400" : ""}`} />
            </button>
            <button onClick={() => onShare(file)}
              className="p-2 rounded-lg bg-background border border-border text-muted hover:text-foreground transition-all">
              <Share2 className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(file.id)}
              className="p-2 rounded-lg bg-background border border-danger/30 text-danger hover:bg-danger/10 transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/_components/FilePreviewPanel.tsx
git commit -m "feat: add FilePreviewPanel with apercu/modifier/infos tabs and action footer"
```

---

## Task 5: FileList component

Colonne centrale : breadcrumb cliquable, liste fichiers/dossiers, toolbar Upload + Nouveau dossier.

**Files:**
- Create: `src/app/dashboard/_components/FileList.tsx`

- [ ] **Step 1: Create FileList**

```typescript
// src/app/dashboard/_components/FileList.tsx
"use client";

import { FolderClosed, FileText, Image, Film, FileArchive, Star, Lock, ChevronRight, Home, Plus, Upload } from "lucide-react";

interface VaultFile {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number;
  isFolder: boolean;
  isStarred: boolean;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface Props {
  files: VaultFile[];
  selectedId: string | null;
  onSelect: (file: VaultFile) => void;
  onFolderOpen: (folder: VaultFile) => void;
  breadcrumb: BreadcrumbItem[];
  onBreadcrumbNav: (index: number) => void;
  onUpload: (file: File, parentFolderId: string | null) => void;
  onNewFolder: (parentFolderId: string | null) => void;
  currentFolderId: string | null;
  filter?: string;
  title?: string;
}

function fileTypeIcon(file: VaultFile) {
  if (file.isFolder) return <FolderClosed className="w-5 h-5 text-primary" />;
  const mime = file.mimeType ?? "";
  if (mime.startsWith("image/")) return <Image className="w-5 h-5 text-emerald-400" />;
  if (mime.startsWith("video/")) return <Film className="w-5 h-5 text-purple-400" />;
  if (mime.includes("zip") || mime.includes("tar")) return <FileArchive className="w-5 h-5 text-amber-400" />;
  return <FileText className="w-5 h-5 text-blue-400" />;
}

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1_048_576).toFixed(1)} Mo`;
}

export default function FileList({
  files, selectedId, onSelect, onFolderOpen,
  breadcrumb, onBreadcrumbNav,
  onUpload, onNewFolder, currentFolderId,
  filter, title,
}: Props) {
  const showToolbar = !filter; // no upload/new folder in filtered views

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onUpload(f, currentFolderId);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col h-full border-r border-border">
      {/* Breadcrumb — only for main file view */}
      {!filter && (
        <div className="flex items-center gap-1 px-3 py-2.5 border-b border-border bg-card text-xs text-muted overflow-x-auto shrink-0">
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-1 shrink-0">
              {i > 0 && <ChevronRight className="w-3 h-3 text-border" />}
              <button
                onClick={() => onBreadcrumbNav(i)}
                className={`flex items-center gap-1 hover:text-foreground transition-colors ${i === breadcrumb.length - 1 ? "text-foreground font-medium" : "hover:underline"}`}
              >
                {i === 0 && <Home className="w-3 h-3" />}
                {item.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
          <button
            onClick={() => onNewFolder(currentFolderId)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-md transition-all"
          >
            <Plus className="w-3 h-3" /> Dossier
          </button>
          <label className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-background border border-border hover:bg-card-hover text-muted hover:text-foreground rounded-md transition-all cursor-pointer">
            <Upload className="w-3 h-3" /> Fichier
            <input type="file" className="hidden" onChange={handleFileInput} />
          </label>
        </div>
      )}

      {/* Title for filtered views */}
      {filter && title && (
        <div className="px-3 py-2.5 border-b border-border bg-card text-xs font-medium text-muted shrink-0">
          {title}
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {files.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted text-xs text-center gap-2">
            <FolderClosed className="w-8 h-8 opacity-20" />
            <span>Aucun fichier</span>
          </div>
        )}
        {files.map((file) => (
          <div
            key={file.id}
            onClick={() => file.isFolder ? onFolderOpen(file) : onSelect(file)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all group ${
              selectedId === file.id
                ? "bg-primary/10 border border-primary/30"
                : "hover:bg-card-hover border border-transparent"
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${file.isFolder ? "bg-primary/10" : "bg-background"}`}>
              {fileTypeIcon(file)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                {file.isStarred && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {!file.isFolder && <Lock className="w-3 h-3 text-success" />}
                <span className="text-xs text-muted">
                  {file.isFolder ? "Dossier" : formatSize(file.sizeBytes)}
                </span>
              </div>
            </div>
            {file.isFolder && <ChevronRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-all shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/_components/FileList.tsx
git commit -m "feat: add FileList component with breadcrumb, folder navigation and toolbar"
```

---

## Task 6: FileExplorer — layout 3 colonnes

Composant conteneur qui gère l'état (dossier courant, fichier sélectionné, breadcrumb) et orchestre FileList + FilePreviewPanel.

**Files:**
- Create: `src/app/dashboard/_components/FileExplorer.tsx`

- [ ] **Step 1: Create FileExplorer**

```typescript
// src/app/dashboard/_components/FileExplorer.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import FileList from "./FileList";
import FilePreviewPanel from "./FilePreviewPanel";
import { X } from "lucide-react";

export interface VaultFile {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number;
  isFolder: boolean;
  isStarred: boolean;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface Props {
  filter?: "recent" | "starred" | "trash";
  title?: string;
}

const FILTER_LABELS: Record<string, string> = {
  recent: "⏱ 20 fichiers récents",
  starred: "⭐ Fichiers favoris",
  trash: "🗑 Fichiers supprimés",
};

export default function FileExplorer({ filter, title }: Props) {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: "Mes fichiers" }]);
  const [shareModal, setShareModal] = useState<VaultFile | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMsg, setShareMsg] = useState("");

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/files";
      if (filter) {
        url += `?filter=${filter}`;
      } else {
        url += currentFolderId ? `?parentId=${currentFolderId}` : "";
      }
      const res = await fetch(url);
      if (res.ok) setFiles(await res.json());
    } finally {
      setLoading(false);
    }
  }, [filter, currentFolderId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleFolderOpen = (folder: VaultFile) => {
    setCurrentFolderId(folder.id);
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFile(null);
  };

  const handleBreadcrumbNav = (index: number) => {
    const item = breadcrumb[index];
    setCurrentFolderId(item.id);
    setBreadcrumb((prev) => prev.slice(0, index + 1));
    setSelectedFile(null);
  };

  const handleUpload = async (file: File, parentFolderId: string | null) => {
    const fd = new FormData();
    fd.append("file", file);
    if (parentFolderId) fd.append("parentFolderId", parentFolderId);
    await fetch("/api/files/upload", { method: "POST", body: fd });
    loadFiles();
  };

  const handleNewFolder = async (parentFolderId: string | null) => {
    const name = prompt("Nom du dossier :");
    if (!name?.trim()) return;
    await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), parentFolderId }),
    });
    loadFiles();
  };

  const handleStarToggle = async (file: VaultFile) => {
    await fetch(`/api/files/${file.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isStarred: !file.isStarred }),
    });
    loadFiles();
    if (selectedFile?.id === file.id) {
      setSelectedFile({ ...file, isStarred: !file.isStarred });
    }
  };

  const handleDelete = async (fileId: string) => {
    if (filter === "trash") {
      await fetch(`/api/files/${fileId}/permanent`, { method: "DELETE" });
    } else {
      await fetch(`/api/files/${fileId}`, { method: "DELETE" });
    }
    setSelectedFile(null);
    loadFiles();
  };

  const handleRestore = async (fileId: string) => {
    await fetch(`/api/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    setSelectedFile(null);
    loadFiles();
  };

  const handleShare = async () => {
    if (!shareModal || !shareEmail) return;
    const res = await fetch(`/api/files/${shareModal.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: shareEmail, permission: "read" }),
    });
    const data = await res.json();
    setShareMsg(res.ok ? "Fichier partagé avec succès !" : (data.error ?? "Erreur"));
    if (res.ok) setShareEmail("");
  };

  return (
    <div className="flex h-full min-h-0 -m-6">
      {/* Col 2: File list */}
      <div className="w-72 shrink-0 flex flex-col min-h-0">
        {loading ? (
          <div className="flex items-center justify-center flex-1 text-muted">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <FileList
            files={files}
            selectedId={selectedFile?.id ?? null}
            onSelect={setSelectedFile}
            onFolderOpen={handleFolderOpen}
            breadcrumb={breadcrumb}
            onBreadcrumbNav={handleBreadcrumbNav}
            onUpload={handleUpload}
            onNewFolder={handleNewFolder}
            currentFolderId={currentFolderId}
            filter={filter}
            title={filter ? FILTER_LABELS[filter] : undefined}
          />
        )}
      </div>

      {/* Col 3: Preview panel */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {selectedFile ? (
          <FilePreviewPanel
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
            onStarToggle={handleStarToggle}
            onDelete={handleDelete}
            onShare={(f) => { setShareModal(f); setShareMsg(""); setShareEmail(""); }}
            onSaved={loadFiles}
            isTrash={filter === "trash"}
            onRestore={handleRestore}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted gap-3">
            <div className="w-16 h-16 bg-card border border-border rounded-2xl flex items-center justify-center">
              <span className="text-3xl">📄</span>
            </div>
            <p className="text-sm">Sélectionne un fichier pour le voir</p>
          </div>
        )}
      </div>

      {/* Share modal */}
      {shareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShareModal(null)}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Partager</h3>
              <button onClick={() => setShareModal(null)} className="text-muted hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-muted truncate">{shareModal.name}</p>
            <div className="flex gap-2">
              <input type="email" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)}
                placeholder="email@exemple.com"
                className="flex-1 bg-background border border-border rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <button onClick={handleShare} className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">Partager</button>
            </div>
            {shareMsg && <p className={`text-sm ${shareMsg.includes("succès") ? "text-success" : "text-danger"}`}>{shareMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/_components/FileExplorer.tsx
git commit -m "feat: add FileExplorer 3-column layout with folder navigation and state management"
```

---

## Task 7: Wire dashboard pages

Remplacer le contenu de chaque page dashboard par `<FileExplorer>`.

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/recent/page.tsx`
- Modify: `src/app/dashboard/favorites/page.tsx`
- Modify: `src/app/dashboard/trash/page.tsx`

- [ ] **Step 1: Update dashboard main page**

Remplace tout le contenu de `src/app/dashboard/page.tsx` par :

```typescript
// src/app/dashboard/page.tsx
import FileExplorer from "./_components/FileExplorer";

export default function DashboardPage() {
  return <FileExplorer />;
}
```

- [ ] **Step 2: Update recent page**

Remplace tout le contenu de `src/app/dashboard/recent/page.tsx` par :

```typescript
// src/app/dashboard/recent/page.tsx
import FileExplorer from "../_components/FileExplorer";

export default function RecentPage() {
  return <FileExplorer filter="recent" />;
}
```

- [ ] **Step 3: Update favorites page**

Remplace tout le contenu de `src/app/dashboard/favorites/page.tsx` par :

```typescript
// src/app/dashboard/favorites/page.tsx
import FileExplorer from "../_components/FileExplorer";

export default function FavoritesPage() {
  return <FileExplorer filter="starred" />;
}
```

- [ ] **Step 4: Update trash page**

Remplace tout le contenu de `src/app/dashboard/trash/page.tsx` par :

```typescript
// src/app/dashboard/trash/page.tsx
import FileExplorer from "../_components/FileExplorer";

export default function TrashPage() {
  return <FileExplorer filter="trash" />;
}
```

- [ ] **Step 5: Update dashboard layout main area to use full height**

Dans `src/app/dashboard/layout.tsx`, la balise `<main>` doit permettre à FileExplorer de remplir l'espace. Remplace :
```typescript
<main className="flex-1 overflow-auto p-6">{children}</main>
```
par :
```typescript
<main className="flex-1 overflow-hidden p-6">{children}</main>
```

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/page.tsx src/app/dashboard/recent/page.tsx src/app/dashboard/favorites/page.tsx src/app/dashboard/trash/page.tsx src/app/dashboard/layout.tsx
git commit -m "feat: wire all dashboard pages to FileExplorer 3-column layout"
```

---

## Task 8: Vérification manuelle finale

- [ ] **Step 1: Ouvrir http://localhost:3001 et vérifier chaque section**

| Action | Résultat attendu |
|---|---|
| Cliquer sur "Mes fichiers" | Liste 3 colonnes, dossiers + fichiers |
| Cliquer sur un dossier | Entre dans le dossier, breadcrumb mis à jour |
| Cliquer sur un fichier PDF | Panneau droit s'ouvre, onglet Aperçu affiche le PDF |
| Cliquer sur un fichier image | Aperçu affiche l'image |
| Onglet Modifier sur un `.md` | Textarea éditable avec le contenu |
| Bouton Sauvegarder | `PUT /api/files/:id/content` appelé, message "Sauvegardé !" |
| Onglet Modifier sur une image | Canvas avec outils rotation / N&B / recadrage |
| Bouton Télécharger | Fichier téléchargé nativement |
| Bouton ⭐ | Favori toggleé |
| Cliquer "Récents" | Même layout, liste filtrée récents |
| Cliquer "Favoris" | Liste fichiers étoilés |
| Cliquer "Corbeille" | Liste avec boutons Restaurer + Suppr. définitif |
| Onglet Infos | Métadonnées + champ renommer |
| Champ renommer + OK | Nom mis à jour dans la liste |

- [ ] **Step 2: Vérifier la console pour les erreurs**

Aucune erreur rouge dans DevTools Console. Les seules erreurs acceptables sont des warnings de développement Next.js.
