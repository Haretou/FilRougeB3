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
