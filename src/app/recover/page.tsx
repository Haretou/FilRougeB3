"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, KeyRound, Mail, Lock, ArrowLeft } from "lucide-react";
import {
  deriveAccount,
  unwrapVaultKey,
  wrapVaultKey,
  randomSalt,
  setVaultKey,
} from "@/lib/crypto";

export default function RecoverPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Le nouveau mot de passe doit faire au moins 8 caractères");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    try {
      // 1) Recupere le sel de recuperation et derive la cle du code.
      const pre = await fetch(`/api/auth/recover?email=${encodeURIComponent(email)}`);
      const { recoverySalt } = await pre.json();
      const rec = await deriveAccount(code.trim().toUpperCase(), recoverySalt);

      // 2) Verifie le code et recupere la vaultKey chiffree par ce code.
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, recoveryAuthHash: rec.authHash }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Code de récupération incorrect");
        return;
      }

      // 3) Deverrouille la vaultKey, puis la re-enrobe avec le nouveau mdp.
      const vk = await unwrapVaultKey(data.recoveryEncVaultKey, rec.wrapKey);
      const newSalt = randomSalt();
      const next = await deriveAccount(password, newSalt);
      const newEncVaultKey = await wrapVaultKey(vk, next.wrapKey);

      const reset = await fetch("/api/auth/recover-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          recoveryAuthHash: rec.authHash,
          newSalt,
          newAuthHash: next.authHash,
          newEncVaultKey,
        }),
      });
      if (!reset.ok) {
        const d = await reset.json();
        setError(d.error ?? "Échec de la réinitialisation");
        return;
      }

      await setVaultKey(vk);
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Code invalide ou erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Retour à la connexion
        </button>

        <div className="text-center">
          <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Récupération du coffre</h2>
          <p className="text-muted mt-2 text-sm">
            Saisissez votre code de récupération et choisissez un nouveau mot de
            passe maître. Vos fichiers restent intacts.
          </p>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field icon={<Mail className="w-4 h-4 text-muted" />}>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@example.com" required
              className="w-full bg-card border border-border rounded-lg py-3 pl-10 pr-4 text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </Field>
          <Field icon={<KeyRound className="w-4 h-4 text-muted" />}>
            <input
              type="text" value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="Code de récupération (XXXX-XXXX-...)" required
              className="w-full bg-card border border-border rounded-lg py-3 pl-10 pr-4 font-mono text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </Field>
          <Field icon={<Lock className="w-4 h-4 text-muted" />}>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Nouveau mot de passe maître" required
              className="w-full bg-card border border-border rounded-lg py-3 pl-10 pr-4 text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </Field>
          <Field icon={<Lock className="w-4 h-4 text-muted" />}>
            <input
              type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmer le mot de passe" required
              className="w-full bg-card border border-border rounded-lg py-3 pl-10 pr-4 text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </Field>

          <button
            type="submit" disabled={loading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Réinitialiser et déverrouiller"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
      {children}
    </div>
  );
}
