"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, Eye, EyeOff, KeyRound, Mail, User } from "lucide-react";
import {
  randomSalt,
  deriveAccount,
  generateVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
  encryptString,
  setVaultKey,
  generateUserKeypair,
  randomRecoveryCode,
} from "@/lib/crypto";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [codeSaved, setCodeSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isLogin && password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères");
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        // 1) Recupere le sel  2) derive la cle  3) authentifie avec authHash
        const pre = await fetch(
          `/api/auth/prelogin?email=${encodeURIComponent(email)}`
        );
        const { salt } = await pre.json();
        const { authHash, wrapKey } = await deriveAccount(password, salt);

        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, authHash }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Une erreur est survenue");
          return;
        }
        // Deverrouille la cle de coffre localement
        const vk = await unwrapVaultKey(data.encVaultKey, wrapKey);
        await setVaultKey(vk);
      } else {
        // Inscription : tout est chiffre cote client avant l'envoi
        const salt = randomSalt();
        const { authHash, wrapKey } = await deriveAccount(password, salt);
        const vk = await generateVaultKey();
        const encVaultKey = await wrapVaultKey(vk, wrapKey);
        const nameEnc = await encryptString(vk, name);

        // Paire RSA (partage) : cle privee chiffree par la vaultKey.
        const { publicKey, encPrivateKey } = await generateUserKeypair(vk);

        // Code de recuperation : deverrouille la vaultKey si le mdp est perdu.
        const code = randomRecoveryCode();
        const recoverySalt = randomSalt();
        const rec = await deriveAccount(code, recoverySalt);
        const recoveryEncVaultKey = await wrapVaultKey(vk, rec.wrapKey);

        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email, salt, authHash, encVaultKey, nameEnc,
            publicKey, encPrivateKey,
            recoverySalt, recoveryAuthHash: rec.authHash, recoveryEncVaultKey,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Une erreur est survenue");
          return;
        }
        await setVaultKey(vk);
        // On affiche le code de recuperation une seule fois avant d'entrer.
        setRecoveryCode(code);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  };

  // Ecran affiche une seule fois apres l'inscription : le code de recuperation.
  if (recoveryCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto">
            <KeyRound className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Votre code de récupération</h2>
            <p className="text-muted mt-2 text-sm">
              C&apos;est le <strong>seul moyen</strong> de récupérer votre coffre si vous
              oubliez votre mot de passe maître. Nous ne pouvons pas vous le
              redonner : notez-le et gardez-le en lieu sûr.
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="font-mono text-lg tracking-wider text-foreground break-all select-all">
              {recoveryCode}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(recoveryCode)}
              className="flex-1 bg-card border border-border text-foreground py-3 rounded-lg text-sm font-medium hover:bg-card-hover transition-all"
            >
              Copier
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              disabled={!codeSaved}
              className="flex-1 bg-primary hover:bg-primary-hover text-white py-3 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
            >
              Continuer
            </button>
          </div>
          <label className="flex items-center gap-2 justify-center text-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={codeSaved}
              onChange={(e) => setCodeSaved(e.target.checked)}
              className="rounded border-border bg-card"
            />
            J&apos;ai noté mon code de récupération en lieu sûr
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0a0f1c] via-[#0f172a] to-[#1e1b4b] flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xl font-bold text-foreground">SafeLock</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight text-foreground">
            Votre coffre-fort
            <br />
            <span className="text-primary">numerique personnel</span>
          </h1>
          <p className="text-muted text-lg max-w-md">
            Architecture zero-knowledge : vos donnees sont chiffrees avant
            meme de quitter votre appareil. Personne d&apos;autre que vous ne
            peut y acceder.
          </p>

          <div className="space-y-4 pt-4">
            <Feature
              icon={<Lock className="w-5 h-5 text-accent" />}
              title="Chiffrement AES-256-GCM"
              desc="Chiffrement de bout en bout cote client"
            />
            <Feature
              icon={<KeyRound className="w-5 h-5 text-accent" />}
              title="Zero-Knowledge"
              desc="Meme nos serveurs ne peuvent pas lire vos fichiers"
            />
            <Feature
              icon={<Shield className="w-5 h-5 text-accent" />}
              title="Conformite RGPD"
              desc="Vos donnees restent les votres, toujours"
            />
          </div>
        </div>

        <p className="text-muted/50 text-sm">
          &copy; 2026 SafeLock. Tous droits reserves.
        </p>
      </div>

      {/* Right panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xl font-bold text-foreground">SafeLock</span>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">
              {isLogin ? "Connexion" : "Creer un compte"}
            </h2>
            <p className="text-muted mt-2">
              {isLogin
                ? "Accedez a votre coffre-fort securise"
                : "Commencez a proteger vos donnees"}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex bg-card rounded-lg p-1">
            <button
              onClick={() => { setIsLogin(true); setError(""); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
                isLogin
                  ? "bg-primary text-white shadow-lg"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(""); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
                !isLogin
                  ? "bg-primary text-white shadow-lg"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Inscription
            </button>
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Nom complet
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jean Dupont"
                    required={!isLogin}
                    className="w-full bg-card border border-border rounded-lg py-3 pl-10 pr-4 text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@example.com"
                  required
                  className="w-full bg-card border border-border rounded-lg py-3 pl-10 pr-4 text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Mot de passe maitre
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-card border border-border rounded-lg py-3 pl-10 pr-11 text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {!isLogin && (
                <p className="text-xs text-muted">
                  Ce mot de passe sert a deriver votre cle de chiffrement. Il
                  n&apos;est jamais envoye a nos serveurs.
                </p>
              )}
            </div>

            {isLogin && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-muted">
                  <input
                    type="checkbox"
                    className="rounded border-border bg-card"
                  />
                  Se souvenir de moi
                </label>
                <button
                  type="button"
                  onClick={() => router.push("/recover")}
                  className="text-primary hover:text-primary-hover transition-colors"
                >
                  Mot de passe oublie ?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-hover text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  {isLogin ? "Deverrouiller" : "Creer mon coffre-fort"}
                </>
              )}
            </button>
          </form>

          {!isLogin && (
            <p className="text-xs text-center text-muted">
              En creant un compte, vous acceptez nos{" "}
              <span className="text-primary cursor-pointer">
                Conditions d&apos;utilisation
              </span>{" "}
              et notre{" "}
              <span className="text-primary cursor-pointer">
                Politique de confidentialite
              </span>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 bg-card rounded-lg flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted">{desc}</p>
      </div>
    </div>
  );
}
