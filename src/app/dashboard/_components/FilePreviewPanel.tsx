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
