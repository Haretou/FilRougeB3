"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Image,
  FileArchive,
  Film,
  FolderClosed,
  MoreVertical,
  Download,
  Trash2,
  Star,
  Share2,
  Lock,
  CheckCircle2,
  Grid3X3,
  List,
  SortAsc,
  X,
} from "lucide-react";

interface VaultFile {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number;
  isFolder: boolean;
  isStarred: boolean;
  parentFolderId: string | null;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} Ko`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} Mo`;
  return `${(bytes / 1_073_741_824).toFixed(2)} Go`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fileType(file: VaultFile): "document" | "image" | "archive" | "video" | "folder" {
  if (file.isFolder) return "folder";
  const mime = file.mimeType ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("zip") || mime.includes("tar") || mime.includes("rar")) return "archive";
  return "document";
}

const fileIcons = {
  document: FileText,
  image: Image,
  archive: FileArchive,
  video: Film,
  folder: FolderClosed,
};

const fileColors = {
  document: "text-blue-400",
  image: "text-emerald-400",
  archive: "text-amber-400",
  video: "text-purple-400",
  folder: "text-primary",
};

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [contextMenu, setContextMenu] = useState<string | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareModal, setShareModal] = useState<{ fileId: string; fileName: string } | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMsg, setShareMsg] = useState("");

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files");
      if (res.ok) {
        setFiles(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleDownload = async (file: VaultFile) => {
    const res = await fetch(`/api/files/${file.id}/download`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (fileId: string) => {
    await fetch(`/api/files/${fileId}`, { method: "DELETE" });
    setContextMenu(null);
    loadFiles();
  };

  const handleStar = async (file: VaultFile) => {
    await fetch(`/api/files/${file.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isStarred: !file.isStarred }),
    });
    setContextMenu(null);
    loadFiles();
  };

  const handleShare = async () => {
    if (!shareModal || !shareEmail) return;
    const res = await fetch(`/api/files/${shareModal.fileId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: shareEmail, permission: "read" }),
    });
    const data = await res.json();
    if (res.ok) {
      setShareMsg("Fichier partagé avec succès !");
      setShareEmail("");
    } else {
      setShareMsg(data.error ?? "Erreur lors du partage");
    }
  };

  return (
    <div className="space-y-6" onClick={() => setContextMenu(null)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mes fichiers</h1>
          <p className="text-sm text-muted mt-1">
            {files.length} element{files.length !== 1 ? "s" : ""} — Tous chiffres AES-256-GCM
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-foreground bg-card border border-border rounded-lg transition-all">
            <SortAsc className="w-4 h-4" />
            Trier
          </button>
          <div className="flex bg-card border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-all ${
                viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-all ${
                viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Security banner */}
      <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
        <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
        <div>
          <p className="text-sm font-medium text-success">Coffre-fort securise</p>
          <p className="text-xs text-muted mt-0.5">
            Tous vos fichiers sont chiffres de bout en bout. Derivation de cle via Argon2id.
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!loading && files.length === 0 && (
        <div className="text-center py-16 text-muted">
          <FolderClosed className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun fichier. Cliquez sur &quot;Ajouter un fichier&quot; pour commencer.</p>
        </div>
      )}

      {!loading && files.length > 0 && (
        viewMode === "list" ? (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_100px_140px_80px] gap-4 px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider border-b border-border">
              <span>Nom</span>
              <span>Taille</span>
              <span>Cree le</span>
              <span className="text-right">Actions</span>
            </div>

            {files.map((file) => {
              const type = fileType(file);
              const Icon = fileIcons[type];
              return (
                <div
                  key={file.id}
                  className="grid grid-cols-[1fr_100px_140px_80px] gap-4 px-4 py-3 items-center hover:bg-card-hover transition-all border-b border-border/50 last:border-0 group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${type === "folder" ? "bg-primary/10" : "bg-background"}`}>
                      <Icon className={`w-5 h-5 ${fileColors[type]}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                        {file.isStarred && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Lock className="w-3 h-3 text-success" />
                        <span className="text-xs text-success">Chiffre</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-sm text-muted">{formatSize(file.sizeBytes)}</span>
                  <span className="text-sm text-muted">{formatDate(file.createdAt)}</span>

                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    {!file.isFolder && (
                      <button onClick={() => handleDownload(file)} className="p-1.5 text-muted hover:text-foreground rounded-md hover:bg-background transition-all">
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => { setShareModal({ fileId: file.id, fileName: file.name }); setShareMsg(""); }}
                      className="p-1.5 text-muted hover:text-foreground rounded-md hover:bg-background transition-all"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setContextMenu(contextMenu === file.id ? null : file.id)}
                        className="p-1.5 text-muted hover:text-foreground rounded-md hover:bg-background transition-all"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {contextMenu === file.id && (
                        <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl py-1 z-10 w-40">
                          <button onClick={() => handleStar(file)} className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-card-hover w-full transition-all">
                            <Star className="w-4 h-4" />
                            {file.isStarred ? "Retirer favori" : "Favori"}
                          </button>
                          <button onClick={() => { setShareModal({ fileId: file.id, fileName: file.name }); setShareMsg(""); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-card-hover w-full transition-all">
                            <Share2 className="w-4 h-4" />
                            Partager
                          </button>
                          <button onClick={() => handleDelete(file.id)} className="flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/10 w-full transition-all">
                            <Trash2 className="w-4 h-4" />
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {files.map((file) => {
              const type = fileType(file);
              const Icon = fileIcons[type];
              return (
                <div
                  key={file.id}
                  className="bg-card border border-border rounded-lg p-4 hover:bg-card-hover hover:border-primary/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${type === "folder" ? "bg-primary/10" : "bg-background"}`}>
                      <Icon className={`w-6 h-6 ${fileColors[type]}`} />
                    </div>
                    {file.isStarred && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted">{formatSize(file.sizeBytes)}</span>
                    <Lock className="w-3 h-3 text-success" />
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Share modal */}
      {shareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShareModal(null)}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Partager</h3>
              <button onClick={() => setShareModal(null)} className="text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted truncate">{shareModal.fileName}</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="email@exemple.com"
                className="flex-1 bg-background border border-border rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={handleShare}
                className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
              >
                Partager
              </button>
            </div>
            {shareMsg && (
              <p className={`text-sm ${shareMsg.includes("succès") ? "text-success" : "text-danger"}`}>
                {shareMsg}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
