"use client";

import { useState } from "react";
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
} from "lucide-react";

interface VaultFile {
  id: string;
  name: string;
  type: "document" | "image" | "archive" | "video" | "folder";
  size: string;
  modified: string;
  encrypted: boolean;
  starred: boolean;
}

const mockFiles: VaultFile[] = [
  {
    id: "1",
    name: "Documents Identite",
    type: "folder",
    size: "—",
    modified: "02 avr. 2026",
    encrypted: true,
    starred: true,
  },
  {
    id: "2",
    name: "Contrats",
    type: "folder",
    size: "—",
    modified: "28 mars 2026",
    encrypted: true,
    starred: false,
  },
  {
    id: "3",
    name: "carte_identite_recto.pdf",
    type: "document",
    size: "2.4 Mo",
    modified: "01 avr. 2026",
    encrypted: true,
    starred: true,
  },
  {
    id: "4",
    name: "passeport_scan.pdf",
    type: "document",
    size: "5.1 Mo",
    modified: "30 mars 2026",
    encrypted: true,
    starred: false,
  },
  {
    id: "5",
    name: "photo_permis.jpg",
    type: "image",
    size: "1.8 Mo",
    modified: "29 mars 2026",
    encrypted: true,
    starred: false,
  },
  {
    id: "6",
    name: "releve_bancaire_mars.pdf",
    type: "document",
    size: "340 Ko",
    modified: "28 mars 2026",
    encrypted: true,
    starred: false,
  },
  {
    id: "7",
    name: "testament_notarie.pdf",
    type: "document",
    size: "890 Ko",
    modified: "15 mars 2026",
    encrypted: true,
    starred: true,
  },
  {
    id: "8",
    name: "backup_mots_de_passe.zip",
    type: "archive",
    size: "12 Ko",
    modified: "10 mars 2026",
    encrypted: true,
    starred: false,
  },
  {
    id: "9",
    name: "video_surveillance.mp4",
    type: "video",
    size: "45.2 Mo",
    modified: "05 mars 2026",
    encrypted: true,
    starred: false,
  },
];

const fileIcons: Record<VaultFile["type"], typeof FileText> = {
  document: FileText,
  image: Image,
  archive: FileArchive,
  video: Film,
  folder: FolderClosed,
};

const fileColors: Record<VaultFile["type"], string> = {
  document: "text-blue-400",
  image: "text-emerald-400",
  archive: "text-amber-400",
  video: "text-purple-400",
  folder: "text-primary",
};

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [contextMenu, setContextMenu] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mes fichiers</h1>
          <p className="text-sm text-muted mt-1">
            9 elements — Tous chiffres AES-256-GCM
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
                viewMode === "list"
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-all ${
                viewMode === "grid"
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:text-foreground"
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
          <p className="text-sm font-medium text-success">
            Coffre-fort securise
          </p>
          <p className="text-xs text-muted mt-0.5">
            Tous vos fichiers sont chiffres de bout en bout. Derivation de cle via Argon2id.
          </p>
        </div>
      </div>

      {/* File list */}
      {viewMode === "list" ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_140px_80px] gap-4 px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider border-b border-border">
            <span>Nom</span>
            <span>Taille</span>
            <span>Modifie</span>
            <span className="text-right">Actions</span>
          </div>

          {/* File rows */}
          {mockFiles.map((file) => {
            const Icon = fileIcons[file.type];
            return (
              <div
                key={file.id}
                className="grid grid-cols-[1fr_100px_140px_80px] gap-4 px-4 py-3 items-center hover:bg-card-hover transition-all border-b border-border/50 last:border-0 group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      file.type === "folder"
                        ? "bg-primary/10"
                        : "bg-background"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${fileColors[file.type]}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {file.name}
                      </p>
                      {file.starred && (
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                      )}
                    </div>
                    {file.encrypted && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Lock className="w-3 h-3 text-success" />
                        <span className="text-xs text-success">Chiffre</span>
                      </div>
                    )}
                  </div>
                </div>

                <span className="text-sm text-muted">{file.size}</span>
                <span className="text-sm text-muted">{file.modified}</span>

                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 text-muted hover:text-foreground rounded-md hover:bg-background transition-all">
                    <Download className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 text-muted hover:text-foreground rounded-md hover:bg-background transition-all">
                    <Share2 className="w-4 h-4" />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() =>
                        setContextMenu(
                          contextMenu === file.id ? null : file.id
                        )
                      }
                      className="p-1.5 text-muted hover:text-foreground rounded-md hover:bg-background transition-all"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {contextMenu === file.id && (
                      <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl py-1 z-10 w-40">
                        <button className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-card-hover w-full transition-all">
                          <Star className="w-4 h-4" />
                          Favori
                        </button>
                        <button className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-card-hover w-full transition-all">
                          <Share2 className="w-4 h-4" />
                          Partager
                        </button>
                        <button className="flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/10 w-full transition-all">
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
        /* Grid view */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {mockFiles.map((file) => {
            const Icon = fileIcons[file.type];
            return (
              <div
                key={file.id}
                className="bg-card border border-border rounded-lg p-4 hover:bg-card-hover hover:border-primary/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`w-11 h-11 rounded-lg flex items-center justify-center ${
                      file.type === "folder"
                        ? "bg-primary/10"
                        : "bg-background"
                    }`}
                  >
                    <Icon
                      className={`w-6 h-6 ${fileColors[file.type]}`}
                    />
                  </div>
                  {file.starred && (
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  )}
                </div>
                <p className="text-sm font-medium text-foreground truncate">
                  {file.name}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted">{file.size}</span>
                  <div className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-success" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
