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
}

const FILTER_LABELS: Record<string, string> = {
  recent: "⏱ 20 fichiers récents",
  starred: "⭐ Fichiers favoris",
  trash: "🗑 Fichiers supprimés",
};

export default function FileExplorer({ filter }: Props) {
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
