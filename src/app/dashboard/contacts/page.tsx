"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, Plus, Search, Pencil, Trash2, Share2 } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-violet-500",
];

function avatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState<null | "add" | Contact>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contacts");
      if (res.ok) setContacts(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadContacts(); }, []);

  const filtered = useMemo(() =>
    contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
    ),
    [contacts, search]
  );

  const openAdd = () => {
    setFormName("");
    setFormEmail("");
    setFormError("");
    setModal("add");
  };

  const openEdit = (c: Contact) => {
    setFormName(c.name);
    setFormEmail(c.email);
    setFormError("");
    setModal(c);
  };

  const handleSave = async () => {
    setFormError("");
    if (!formName.trim()) { setFormError("Le nom est requis."); return; }
    if (!formEmail.trim()) { setFormError("L'email est requis."); return; }
    setSaving(true);

    try {
      let res: Response;
      if (modal === "add") {
        res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, email: formEmail }),
        });
      } else {
        res = await fetch(`/api/contacts/${(modal as Contact).id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, email: formEmail }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error ?? "Erreur");
        return;
      }

      setModal(null);
      await loadContacts();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce contact ?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    await loadContacts();
  };

  const handleShareClick = (c: Contact) => {
    sessionStorage.setItem("shareTargetEmail", c.email);
    sessionStorage.setItem("shareTargetName", c.name);
    window.location.href = "/dashboard";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Contacts
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""} enregistré{contacts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          Nouveau contact
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou email…"
          className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center flex-1 text-muted">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted gap-3">
          <Users className="w-10 h-10 opacity-20" />
          <p className="text-sm">
            {search ? "Aucun contact trouvé" : "Aucun contact enregistré"}
          </p>
          {!search && (
            <button onClick={openAdd} className="text-sm text-primary hover:underline">
              Ajouter un contact
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto flex-1">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-all"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${avatarColor(c.name)}`}
              >
                {initials(c.name)}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                <p className="text-xs text-muted truncate">{c.email}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleShareClick(c)}
                  className="flex items-center gap-1.5 text-xs bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-lg transition-all"
                >
                  <Share2 className="w-3 h-3" />
                  Partager
                </button>
                <button
                  onClick={() => openEdit(c)}
                  className="text-muted hover:text-foreground p-1.5 rounded-lg hover:bg-card-hover transition-all"
                  title="Modifier"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-danger hover:text-danger p-1.5 rounded-lg hover:bg-danger/10 transition-all"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {modal !== null && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-card border border-border rounded-xl p-6 w-full max-w-sm mx-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-foreground">
              {modal === "add" ? "Nouveau contact" : "Modifier le contact"}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Nom</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="jean.dupont@gmail.com"
                  className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
              {formError && <p className="text-xs text-danger">{formError}</p>}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setModal(null)}
                className="flex-1 bg-background border border-border text-muted hover:text-foreground hover:bg-card-hover text-sm py-2 rounded-lg transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-all"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
