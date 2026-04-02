"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const navItems = [
    { icon: FolderClosed, label: "Mes fichiers", href: "/dashboard", active: true },
    { icon: Clock, label: "Recents", href: "/dashboard", active: false },
    { icon: Star, label: "Favoris", href: "/dashboard", active: false },
    { icon: Trash2, label: "Corbeille", href: "/dashboard", active: false },
  ];

  const storageUsed = 2.4;
  const storageTotal = 10;
  const storagePercent = (storageUsed / storageTotal) * 100;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
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

        {/* New upload button */}
        <div className="p-4">
          <button className="w-full bg-primary hover:bg-primary-hover text-white font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Ajouter un fichier
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                item.active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted hover:text-foreground hover:bg-card-hover"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Storage indicator */}
        <div className="p-4 mx-3 mb-3 bg-background rounded-lg">
          <div className="flex items-center gap-2 text-sm text-muted mb-2">
            <HardDrive className="w-4 h-4" />
            <span>Stockage</span>
          </div>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <p className="text-xs text-muted mt-2">
            {storageUsed} Go sur {storageTotal} Go utilises
          </p>
        </div>

        {/* Bottom nav */}
        <div className="border-t border-border p-3 space-y-1">
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted hover:text-foreground hover:bg-card-hover transition-all w-full">
            <Settings className="w-4 h-4" />
            Parametres
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-danger hover:bg-danger/10 transition-all w-full"
          >
            <LogOut className="w-4 h-4" />
            Deconnexion
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
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
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
            </button>

            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary">JD</span>
              </div>
              <ChevronDown className="w-4 h-4 text-muted" />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
