// src/app/dashboard/_components/FileExplorer.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import FileList from "./FileList";
import FilePreviewPanel from "./FilePreviewPanel";
import { X } from "lucide-react";
import {
  requireVaultKey,
  unwrapFileKey,
  decryptString,
  encryptString,
  generateFileKey,
  wrapFileKey,
  wrapFileKeyForRecipient,
  encryptFileForUpload,
} from "@/lib/crypto";

interface Contact {
  id: string;
  name: string;
  email: string;
}

export interface VaultFile {
  id: string;
  name: string;
  mimeType: string | null;
  /** Cle du fichier chiffree par la vaultKey (necessaire pour dechiffrer). */
  fileKeyEnc: string;
  sizeBytes: number;
  isFolder: boolean;
  isStarred: boolean;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Forme brute renvoyee par l'API (blobs chiffres).
interface EncryptedFile {
  id: string;
  nameEnc: string;
  mimeEnc: string | null;
  fileKeyEnc: string;
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
  const router = useRouter();
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: "Mes fichiers" }]);
  const [shareModal, setShareModal] = useState<VaultFile | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

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
      if (!res.ok) return;
      const raw: EncryptedFile[] = await res.json();

      let vk;
      try {
        vk = await requireVaultKey();
      } catch {
        router.push("/"); // coffre verrouille -> reconnexion
        return;
      }

      // Dechiffre nom + type de chaque entree avec sa cle de fichier.
      const decrypted = await Promise.all(
        raw.map(async (r): Promise<VaultFile> => {
          try {
            const fk = await unwrapFileKey(r.fileKeyEnc, vk);
            const name = await decryptString(fk, r.nameEnc);
            const mimeType = r.mimeEnc ? await decryptString(fk, r.mimeEnc) : null;
            return { ...r, name, mimeType };
          } catch {
            return { ...r, name: "⚠ Déchiffrement impossible", mimeType: null };
          }
        })
      );
      setFiles(decrypted);
    } finally {
      setLoading(false);
    }
  }, [filter, currentFolderId, router]);

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
    const vk = await requireVaultKey();
    const enc = await encryptFileForUpload(vk, file);
    const fd = new FormData();
    fd.append("file", enc.content, `${file.name}.enc`);
    fd.append("nameEnc", enc.nameEnc);
    fd.append("mimeEnc", enc.mimeEnc);
    fd.append("fileKeyEnc", enc.fileKeyEnc);
    fd.append("sizeBytes", String(enc.sizeBytes));
    if (parentFolderId) fd.append("parentFolderId", parentFolderId);
    await fetch("/api/files/upload", { method: "POST", body: fd });
    loadFiles();
  };

  const handleNewFolder = async (parentFolderId: string | null) => {
    const name = prompt("Nom du dossier :");
    if (!name?.trim()) return;
    const vk = await requireVaultKey();
    const fk = await generateFileKey();
    const nameEnc = await encryptString(fk, name.trim());
    const fileKeyEnc = await wrapFileKey(fk, vk);
    await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameEnc, fileKeyEnc, parentFolderId }),
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

  const openShareModal = async (f: VaultFile) => {
    setShareModal(f);
    setShareMsg("");
    setShareEmail("");
    setSelectedContact(null);
    const res = await fetch("/api/contacts");
    if (res.ok) setContacts(await res.json());
    else setContacts([]);
  };

  const handleContactSelect = (c: Contact) => {
    if (selectedContact?.id === c.id) {
      setSelectedContact(null);
      setShareEmail("");
    } else {
      setSelectedContact(c);
      setShareEmail(c.email);
    }
  };

  const handleShare = async () => {
    if (!shareModal || !shareEmail) return;
    setShareMsg("");
    try {
      const vk = await requireVaultKey();

      // Recupere la cle publique du destinataire.
      const pk = await fetch(`/api/users/pubkey?email=${encodeURIComponent(shareEmail)}`);
      const pkData = await pk.json();
      if (!pk.ok) {
        setShareMsg(pkData.error ?? "Destinataire introuvable");
        return;
      }

      // Enrobe la cle du fichier avec la cle publique RSA du destinataire :
      // lui seul pourra la dechiffrer avec sa cle privee.
      const fileKeyEncrypted = await wrapFileKeyForRecipient(
        shareModal.fileKeyEnc,
        vk,
        pkData.publicKey
      );

      const res = await fetch(`/api/files/${shareModal.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: shareEmail, permission: "read", fileKeyEncrypted }),
      });
      const data = await res.json();
      setShareMsg(res.ok ? "Fichier partagé avec succès !" : (data.error ?? "Erreur"));
      if (res.ok) { setShareEmail(""); setSelectedContact(null); }
    } catch {
      setShareMsg("Erreur lors du partage");
    }
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
            onShare={(f) => { openShareModal(f); }}
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
            <p className="text-sm text-muted truncate">📄 {shareModal.name}</p>

            {/* Contacts picker */}
            {contacts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Mes contacts</p>
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                  {contacts.map((c) => {
                    const selected = selectedContact?.id === c.id;
                    const avatarColors = ["bg-indigo-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-sky-500","bg-violet-500"];
                    const color = avatarColors[c.name.charCodeAt(0) % avatarColors.length];
                    const inits = c.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleContactSelect(c)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                          selected ? "bg-primary text-white" : "bg-background hover:bg-card-hover"
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${selected ? "bg-white/20" : color}`}>
                          {inits}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${selected ? "text-white" : "text-foreground"}`}>{c.name}</p>
                          <p className={`text-xs truncate ${selected ? "text-white/70" : "text-muted"}`}>{c.email}</p>
                        </div>
                        {selected && <span className="text-white text-sm shrink-0">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Divider */}
            {contacts.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted">ou saisir manuellement</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            {/* Manual email */}
            <input
              type="email"
              value={shareEmail}
              onChange={(e) => { setShareEmail(e.target.value); setSelectedContact(null); }}
              placeholder="email@exemple.com"
              className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />

            <button
              onClick={handleShare}
              disabled={!shareEmail}
              className="w-full bg-primary hover:bg-primary-hover disabled:opacity-40 text-white font-medium py-2 rounded-lg text-sm transition-all"
            >
              {selectedContact ? `↗ Partager avec ${selectedContact.name}` : "↗ Partager"}
            </button>

            {shareMsg && <p className={`text-sm ${shareMsg.includes("succès") ? "text-success" : "text-danger"}`}>{shareMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
