"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Shield,
  FolderClosed,
  Clock,
  Star,
  Trash2,
  Settings,
  LogOut,
  Search,
  Bell,
  ChevronDown,
  Plus,
  HardDrive,
  KeyRound,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  storageUsed: number;
  storageLimit: number;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) { router.push("/"); return null; }
        return r.json();
      })
      .then((data) => data && setUser(data))
      .catch(() => router.push("/"));
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const storageUsedGb = user ? user.storageUsed / 1_073_741_824 : 0;
  const storageLimitGb = user ? user.storageLimit / 1_073_741_824 : 10;
  const storagePercent = storageLimitGb > 0 ? (storageUsedGb / storageLimitGb) * 100 : 0;

  const initials = user
    ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const navItems = [
    { icon: FolderClosed, label: "Mes fichiers",  href: "/dashboard" },
    { icon: Clock,        label: "Récents",        href: "/dashboard/recent" },
    { icon: Star,         label: "Favoris",        href: "/dashboard/favorites" },
    { icon: Trash2,       label: "Corbeille",      href: "/dashboard/trash" },
    { icon: KeyRound,     label: "Mots de passe",  href: "/dashboard/passwords" },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 bg-card border-r border-border flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/20 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <span className="text-lg font-bold text-foreground">SafeLock</span>
          </Link>
        </div>

        {/* Upload button */}
        <div className="p-4">
          <label className="w-full bg-primary hover:bg-primary-hover text-white font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-sm cursor-pointer">
            <Plus className="w-4 h-4" />
            Ajouter un fichier
            <input
              type="file"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.append("file", file);
                await fetch("/api/files/upload", { method: "POST", body: fd });
                if (pathname === "/dashboard") window.location.reload();
                else router.push("/dashboard");
              }}
            />
          </label>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const active = item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted hover:text-foreground hover:bg-card-hover"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Storage */}
        <div className="p-4 mx-3 mb-3 bg-background rounded-lg">
          <div className="flex items-center gap-2 text-sm text-muted mb-2">
            <HardDrive className="w-4 h-4" />
            <span>Stockage</span>
          </div>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.min(storagePercent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted mt-2">
            {storageUsedGb.toFixed(2)} Go sur {storageLimitGb.toFixed(0)} Go utilisés
          </p>
        </div>

        {/* Bottom */}
        <div className="border-t border-border p-3 space-y-1">
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted hover:text-foreground hover:bg-card-hover transition-all w-full">
            <Settings className="w-4 h-4" />
            Paramètres
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-danger hover:bg-danger/10 transition-all w-full"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/50 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans le coffre-fort..."
              className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>

          <div className="flex items-center gap-4 ml-4">
            <button className="relative text-muted hover:text-foreground transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary">{initials}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-muted" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
