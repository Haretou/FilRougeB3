"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Download, Lock, Loader2, FileText } from "lucide-react";
import {
  getVaultKey,
  importEncryptedPrivateKey,
  unwrapSharedFileKey,
  decryptString,
  decryptBytes,
} from "@/lib/crypto";

interface SharedRaw {
  id: string;
  nameEnc: string;
  mimeEnc: string | null;
  fileKeyEncRsa: string;
  sizeBytes: number;
  permission: string;
  sharedBy: string;
  createdAt: string;
}

interface SharedFile {
  id: string;
  name: string;
  mimeType: string | null;
  fileKeyEncRsa: string;
  sizeBytes: number;
  permission: string;
  sharedBy: string;
}

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1_048_576).toFixed(1)} Mo`;
}

export default function SharedPage() {
  const router = useRouter();
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const vk = await getVaultKey();
      if (!vk) { router.push("/"); return; }

      try {
        // Cle privee RSA du destinataire (chiffree par la vaultKey).
        const me = await fetch("/api/auth/me").then((r) => r.json());
        const privateKey = await importEncryptedPrivateKey(me.encPrivateKey, vk);

        const raw: SharedRaw[] = await fetch("/api/files/shared").then((r) => r.json());
        const dec = await Promise.all(
          raw.map(async (r): Promise<SharedFile> => {
            try {
              const fk = await unwrapSharedFileKey(r.fileKeyEncRsa, privateKey);
              const name = await decryptString(fk, r.nameEnc);
              const mimeType = r.mimeEnc ? await decryptString(fk, r.mimeEnc) : null;
              return { ...r, name, mimeType };
            } catch {
              return { ...r, name: "⚠ Déchiffrement impossible", mimeType: null };
            }
          })
        );
        setFiles(dec);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handleDownload = async (file: SharedFile) => {
    setDownloadingId(file.id);
    try {
      const vk = await getVaultKey();
      if (!vk) { router.push("/"); return; }
      const me = await fetch("/api/auth/me").then((r) => r.json());
      const privateKey = await importEncryptedPrivateKey(me.encPrivateKey, vk);
      const fk = await unwrapSharedFileKey(file.fileKeyEncRsa, privateKey);

      const res = await fetch(`/api/files/${file.id}/download`);
      const encrypted = new Uint8Array(await res.arrayBuffer());
      const bytes = await decryptBytes(fk, encrypted);

      const blob = new Blob([bytes as BufferSource], {
        type: file.mimeType ?? "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = file.name; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Partagés avec moi</h1>
        <p className="text-sm text-muted mt-1">
          {files.length} fichier{files.length !== 1 ? "s" : ""} chiffré
          {files.length !== 1 ? "s" : ""} rien que pour vous
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!loading && files.length === 0 && (
        <div className="text-center py-16 text-muted">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun fichier ne vous a été partagé.</p>
        </div>
      )}

      {!loading && files.length > 0 && (
        <div className="space-y-3">
          {files.map((f) => (
            <div key={f.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4 hover:border-primary/30 transition-all">
              <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{f.name}</p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
                  <Lock className="w-3 h-3 text-success" />
                  <span>{formatSize(f.sizeBytes)}</span>
                  <span>•</span>
                  <span>de {f.sharedBy}</span>
                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">{f.permission}</span>
                </div>
              </div>
              <button
                onClick={() => handleDownload(f)}
                disabled={downloadingId === f.id}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs px-3 py-2 rounded-lg transition-all disabled:opacity-50 shrink-0"
              >
                {downloadingId === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Télécharger
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
