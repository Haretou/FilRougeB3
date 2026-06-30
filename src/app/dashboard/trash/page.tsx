"use client";

import { useEffect, useState } from "react";
import { FileText, Image, FileArchive, Film, FolderClosed, Lock, Trash2, RotateCcw } from "lucide-react";

interface VaultFile {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number;
  isFolder: boolean;
  createdAt: string;
}

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1_048_576).toFixed(1)} Mo`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function fileType(file: VaultFile) {
  if (file.isFolder) return "folder";
  const mime = file.mimeType ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("zip") || mime.includes("tar")) return "archive";
  return "document";
}

const icons = { document: FileText, image: Image, archive: FileArchive, video: Film, folder: FolderClosed };
const colors = { document: "text-blue-400", image: "text-emerald-400", archive: "text-amber-400", video: "text-purple-400", folder: "text-primary" };

export default function TrashPage() {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/files?filter=trash")
      .then((r) => r.json())
      .then(setFiles)
      .finally(() => setLoading(false));
  }, []);

  const handleRestore = async (fileId: string) => {
    await fetch(`/api/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handlePermanentDelete = async (fileId: string) => {
    await fetch(`/api/files/${fileId}/permanent`, { method: "DELETE" });
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Corbeille</h1>
        <p className="text-sm text-muted mt-1">{files.length} élément{files.length !== 1 ? "s" : ""} supprimé{files.length !== 1 ? "s" : ""}</p>
      </div>

      {loading && <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}

      {!loading && files.length === 0 && (
        <div className="text-center py-16 text-muted">
          <Trash2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>La corbeille est vide.</p>
        </div>
      )}

      {!loading && files.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_160px_100px] gap-4 px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider border-b border-border">
            <span>Nom</span><span>Taille</span><span>Supprimé le</span><span></span>
          </div>
          {files.map((file) => {
            const type = fileType(file);
            const Icon = icons[type];
            return (
              <div key={file.id} className="grid grid-cols-[1fr_100px_160px_100px] gap-4 px-4 py-3 items-center hover:bg-card-hover border-b border-border/50 last:border-0 group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 opacity-50 ${type === "folder" ? "bg-primary/10" : "bg-background"}`}>
                    <Icon className={`w-5 h-5 ${colors[type]}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground/60 truncate line-through">{file.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Lock className="w-3 h-3 text-muted" />
                      <span className="text-xs text-muted">Chiffré</span>
                    </div>
                  </div>
                </div>
                <span className="text-sm text-muted">{formatSize(file.sizeBytes)}</span>
                <span className="text-sm text-muted">{formatDate(file.createdAt)}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleRestore(file.id)} className="p-1.5 text-muted hover:text-success rounded-md hover:bg-background transition-all" title="Restaurer">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button onClick={() => handlePermanentDelete(file.id)} className="p-1.5 text-muted hover:text-danger rounded-md hover:bg-background transition-all" title="Supprimer définitivement">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
