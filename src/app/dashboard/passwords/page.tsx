"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound, Plus, Eye, EyeOff, Trash2, Pencil, Copy, Check, X, Globe,
} from "lucide-react";
import { requireVaultKey, getVaultKey, encryptString, decryptString } from "@/lib/crypto";

interface Password {
  id: string;
  site_name: string;
  username: string;
  password_value: string;
  url: string;
  notes: string;
  created_at: string;
}

interface FormState {
  siteName: string;
  username: string;
  password: string;
  url: string;
  notes: string;
}

const empty: FormState = { siteName: "", username: "", password: "", url: "", notes: "" };

export default function PasswordsPage() {
  const router = useRouter();
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const vk = await getVaultKey();
    if (!vk) { router.push("/"); return; }
    try {
      const res = await fetch("/api/passwords");
      const rows: Password[] = await res.json();
      // Dechiffre les champs sensibles (mot de passe, identifiant, notes).
      const dec = await Promise.all(
        rows.map(async (p) => {
          const safe = async (v: string) => {
            if (!v) return "";
            try { return await decryptString(vk, v); } catch { return v; }
          };
          return {
            ...p,
            password_value: await safe(p.password_value),
            username: await safe(p.username),
            notes: await safe(p.notes),
          };
        })
      );
      setPasswords(dec);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVisible = (id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyPassword = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openEdit = (pw: Password) => {
    setForm({ siteName: pw.site_name, username: pw.username, password: pw.password_value, url: pw.url, notes: pw.notes ?? "" });
    setEditId(pw.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const vk = await requireVaultKey();
      // Chiffre les champs sensibles ; site et URL restent en clair (libelles).
      const payload = {
        siteName: form.siteName,
        url: form.url,
        username: await encryptString(vk, form.username),
        password: await encryptString(vk, form.password),
        notes: await encryptString(vk, form.notes),
      };
      if (editId) {
        await fetch(`/api/passwords/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/passwords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      setEditId(null);
      setForm(empty);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/passwords/${id}`, { method: "DELETE" });
    setPasswords((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mots de passe</h1>
          <p className="text-sm text-muted mt-1">{passwords.length} entrée{passwords.length !== 1 ? "s" : ""} stockée{passwords.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(empty); }}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">{editId ? "Modifier" : "Nouveau mot de passe"}</h3>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wider">Site / Application *</label>
                <input
                  value={form.siteName}
                  onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                  placeholder="Google, GitHub..."
                  required
                  className="w-full mt-1 bg-background border border-border rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wider">Identifiant / Email</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="user@exemple.com"
                  className="w-full mt-1 bg-background border border-border rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wider">Mot de passe *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="w-full mt-1 bg-background border border-border rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wider">URL</label>
                <input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://..."
                  className="w-full mt-1 bg-background border border-border rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wider">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full mt-1 bg-background border border-border rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : editId ? "Modifier" : "Ajouter"}
              </button>
            </form>
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}

      {!loading && passwords.length === 0 && (
        <div className="text-center py-16 text-muted">
          <KeyRound className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun mot de passe. Cliquez sur &quot;Ajouter&quot; pour commencer.</p>
        </div>
      )}

      {!loading && passwords.length > 0 && (
        <div className="space-y-3">
          {passwords.map((pw) => (
            <div key={pw.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-all group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                    {pw.url ? (
                      <img
                        src={`https://www.google.com/s2/favicons?sz=32&domain=${new URL(pw.url.startsWith("http") ? pw.url : `https://${pw.url}`).hostname}`}
                        alt=""
                        className="w-5 h-5"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <Globe className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{pw.site_name}</p>
                    {pw.username && <p className="text-sm text-muted truncate">{pw.username}</p>}
                    {pw.url && (
                      <a href={pw.url.startsWith("http") ? pw.url : `https://${pw.url}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate block">
                        {pw.url}
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-1">
                    <span className="text-sm text-foreground font-mono">
                      {visibleIds.has(pw.id) ? pw.password_value : "••••••••"}
                    </span>
                    <button onClick={() => toggleVisible(pw.id)} className="p-1 text-muted hover:text-foreground">
                      {visibleIds.has(pw.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => copyPassword(pw.id, pw.password_value)} className="p-1 text-muted hover:text-foreground">
                      {copiedId === pw.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button onClick={() => openEdit(pw)} className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-background transition-all opacity-0 group-hover:opacity-100">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(pw.id)} className="p-2 text-muted hover:text-danger rounded-lg hover:bg-background transition-all opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {pw.notes && <p className="text-xs text-muted mt-2 ml-13 pl-13">{pw.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
