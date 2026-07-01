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
