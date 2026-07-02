"use client";

import { useEffect, useState } from "react";
import {
  Activity, LogIn, LogOut, Upload, Download, Trash2, Share2,
  UserPlus, KeyRound, ShieldAlert, RotateCcw, Pencil, ShieldCheck,
} from "lucide-react";

interface AuditEvent {
  id: number;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ip: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

const META: Record<string, { label: string; icon: React.ElementType; tone: string }> = {
  REGISTER:         { label: "Création du compte",        icon: UserPlus,    tone: "text-primary" },
  LOGIN:            { label: "Connexion",                 icon: LogIn,       tone: "text-success" },
  LOGIN_FAILED:     { label: "Connexion échouée",         icon: ShieldAlert, tone: "text-danger" },
  LOGOUT:           { label: "Déconnexion",               icon: LogOut,      tone: "text-muted" },
  UPLOAD:           { label: "Fichier ajouté",            icon: Upload,      tone: "text-success" },
  DOWNLOAD:         { label: "Fichier consulté",          icon: Download,    tone: "text-blue-400" },
  UPDATE:           { label: "Fichier modifié",           icon: Pencil,      tone: "text-blue-400" },
  DELETE:           { label: "Fichier mis à la corbeille",icon: Trash2,      tone: "text-amber-400" },
  DELETE_PERMANENT: { label: "Suppression définitive",    icon: Trash2,      tone: "text-danger" },
  RESTORE:          { label: "Fichier restauré",          icon: RotateCcw,   tone: "text-success" },
  SHARE:            { label: "Fichier partagé",           icon: Share2,      tone: "text-primary" },
  UNSHARE:          { label: "Partage révoqué",           icon: Share2,      tone: "text-muted" },
  PASSWORD_CREATE:  { label: "Mot de passe ajouté",       icon: KeyRound,    tone: "text-success" },
  PASSWORD_DELETE:  { label: "Mot de passe supprimé",     icon: KeyRound,    tone: "text-amber-400" },
  RECOVER:          { label: "Compte récupéré",           icon: ShieldCheck, tone: "text-primary" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function ActivityPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audit")
      .then((r) => (r.ok ? r.json() : []))
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activité & sécurité</h1>
        <p className="text-sm text-muted mt-1">
          Journal d&apos;audit — le serveur trace les actions (qui, quoi, quand)
          sans jamais voir le contenu de vos fichiers.
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="text-center py-16 text-muted">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun événement pour le moment.</p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="space-y-2">
          {events.map((e) => {
            const meta = META[e.action] ?? { label: e.action, icon: Activity, tone: "text-muted" };
            const Icon = meta.icon;
            const withWho = e.details && typeof e.details.with === "string" ? ` → ${e.details.with}` : "";
            return (
              <div key={e.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                <div className="w-9 h-9 bg-background rounded-lg flex items-center justify-center shrink-0">
                  <Icon className={`w-4 h-4 ${meta.tone}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {meta.label}{withWho}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {e.ip}{e.resourceId ? ` • ${e.resourceType} ${e.resourceId.slice(0, 8)}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted shrink-0">{formatDate(e.createdAt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
