// SafeLock - Chiffrement cote client (zero-knowledge)
//
// Tout se passe dans le navigateur : le mot de passe maitre et la cle de
// chiffrement ne quittent JAMAIS l'appareil. Le serveur ne stocke que des
// blobs opaques.
//
// Hierarchie de cles :
//   password ──Argon2id(salt)──► mk (32 o, jamais transmis)
//     ├─ authHash = SHA-256(mk || "auth")   ─► envoye au serveur (auth)
//     └─ wrapKey  = SHA-256(mk || "wrap")    ─► chiffre la vaultKey
//
//   vaultKey (VK) : cle AES-256 aleatoire, generee a l'inscription,
//                   stockee chiffree (wrapKey) cote serveur, gardee en
//                   memoire (sessionStorage) apres deverrouillage.
//
//   Chaque fichier a sa propre cle FK (AES-256) :
//     - le contenu, le nom et le type MIME sont chiffres avec FK
//     - FK est chiffree avec VK et stockee dans file_key_encrypted
//
// Format d'un blob chiffre : iv(12 octets) || ciphertext, encode en base64.

"use client";

import { argon2id } from "hash-wasm";

// --- Parametres Argon2id -----------------------------------------------------
const ARGON2 = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536, // 64 Mo (en Ko)
  hashLength: 32,
} as const;

const AUTH_LABEL = "safelock-auth-v1";
const WRAP_LABEL = "safelock-wrap-v1";
const VK_STORAGE_KEY = "safelock_vk";

// --- Encodage ----------------------------------------------------------------
const enc = new TextEncoder();
const dec = new TextDecoder();

function toBytes(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

export function bytesToB64(data: ArrayBuffer | Uint8Array): string {
  const bytes = toBytes(data);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return new Uint8Array(digest);
}

// --- Salt --------------------------------------------------------------------
export function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(bytes);
}

// --- Derivation du compte ----------------------------------------------------
export interface DerivedAccount {
  /** Envoye au serveur pour l'authentification (le serveur le re-hash). */
  authHash: string;
  /** Cle d'enrobage de la vaultKey, jamais transmise. */
  wrapKey: CryptoKey;
}

export async function deriveAccount(
  password: string,
  saltHex: string
): Promise<DerivedAccount> {
  const mkBytes = await argon2id({
    password,
    salt: hexToBytes(saltHex),
    ...ARGON2,
    outputType: "binary",
  });

  const authHash = bytesToB64(
    await sha256(concat(mkBytes, enc.encode(AUTH_LABEL)))
  );

  const wrapRaw = await sha256(concat(mkBytes, enc.encode(WRAP_LABEL)));
  const wrapKey = await crypto.subtle.importKey(
    "raw",
    wrapRaw as BufferSource,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );

  return { authHash, wrapKey };
}

// --- AES-256-GCM generique ---------------------------------------------------
async function encryptRaw(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data as BufferSource
  );
  return concat(iv, new Uint8Array(ct));
}

async function decryptRaw(key: CryptoKey, blob: Uint8Array): Promise<Uint8Array> {
  const iv = blob.slice(0, 12);
  const ct = blob.slice(12);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ct as BufferSource
  );
  return new Uint8Array(pt);
}

export async function encryptBytes(
  key: CryptoKey,
  data: ArrayBuffer | Uint8Array
): Promise<Uint8Array> {
  return encryptRaw(key, toBytes(data));
}

export async function decryptBytes(
  key: CryptoKey,
  blob: Uint8Array
): Promise<Uint8Array> {
  return decryptRaw(key, blob);
}

export async function encryptString(key: CryptoKey, str: string): Promise<string> {
  return bytesToB64(await encryptRaw(key, enc.encode(str)));
}

export async function decryptString(key: CryptoKey, b64: string): Promise<string> {
  return dec.decode(await decryptRaw(key, b64ToBytes(b64)));
}

// --- Vault key (VK) ----------------------------------------------------------
export function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function wrapVaultKey(vk: CryptoKey, wrapKey: CryptoKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", vk));
  return bytesToB64(await encryptRaw(wrapKey, raw));
}

export async function unwrapVaultKey(
  blobB64: string,
  wrapKey: CryptoKey
): Promise<CryptoKey> {
  const raw = await decryptRaw(wrapKey, b64ToBytes(blobB64));
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", true, [
    "encrypt",
    "decrypt",
  ]);
}

// --- File key (FK) -----------------------------------------------------------
export function generateFileKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function wrapFileKey(fk: CryptoKey, vk: CryptoKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", fk));
  return bytesToB64(await encryptRaw(vk, raw));
}

export async function unwrapFileKey(blobB64: string, vk: CryptoKey): Promise<CryptoKey> {
  const raw = await decryptRaw(vk, b64ToBytes(blobB64));
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", true, [
    "encrypt",
    "decrypt",
  ]);
}

// --- Session (deverrouillage) ------------------------------------------------
// La vaultKey deverrouillee est gardee en sessionStorage : elle survit a un
// rafraichissement d'onglet mais disparait a la fermeture. Compromis pragmatique
// pour une SPA ; un nouvel onglet impose de se reconnecter.

export async function setVaultKey(vk: CryptoKey): Promise<void> {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", vk));
  sessionStorage.setItem(VK_STORAGE_KEY, bytesToB64(raw));
}

export async function getVaultKey(): Promise<CryptoKey | null> {
  const stored = sessionStorage.getItem(VK_STORAGE_KEY);
  if (!stored) return null;
  try {
    return await crypto.subtle.importKey(
      "raw",
      b64ToBytes(stored) as BufferSource,
      "AES-GCM",
      true,
      ["encrypt", "decrypt"]
    );
  } catch {
    return null;
  }
}

export function clearVaultKey(): void {
  sessionStorage.removeItem(VK_STORAGE_KEY);
}

/** Recupere la vaultKey ou leve une erreur explicite (coffre verrouille). */
export async function requireVaultKey(): Promise<CryptoKey> {
  const vk = await getVaultKey();
  if (!vk) throw new Error("Coffre verrouille : reconnectez-vous.");
  return vk;
}

// --- Helpers fichiers (haut niveau) ------------------------------------------

export interface EncryptedUpload {
  content: Blob;
  nameEnc: string;
  mimeEnc: string;
  fileKeyEnc: string;
  sizeBytes: number;
}

/** Chiffre un fichier complet (contenu + nom + type) pour l'upload. */
export async function encryptFileForUpload(
  vk: CryptoKey,
  file: File
): Promise<EncryptedUpload> {
  const fk = await generateFileKey();
  const plain = new Uint8Array(await file.arrayBuffer());
  const content = new Blob([await encryptBytes(fk, plain) as BufferSource], {
    type: "application/octet-stream",
  });
  return {
    content,
    nameEnc: await encryptString(fk, file.name),
    mimeEnc: await encryptString(fk, file.type || "application/octet-stream"),
    fileKeyEnc: await wrapFileKey(fk, vk),
    sizeBytes: file.size,
  };
}

/** Telecharge un fichier chiffre et le dechiffre avec sa FK. */
export async function fetchAndDecrypt(
  fileId: string,
  fileKeyEnc: string,
  vk: CryptoKey
): Promise<Uint8Array> {
  const res = await fetch(`/api/files/${fileId}/download`);
  if (!res.ok) throw new Error("Telechargement impossible");
  const blob = new Uint8Array(await res.arrayBuffer());
  const fk = await unwrapFileKey(fileKeyEnc, vk);
  return decryptBytes(fk, blob);
}

/** Chiffre un nouveau contenu pour un fichier existant (editeurs). */
export async function encryptContentForUpdate(
  data: ArrayBuffer | Uint8Array,
  fileKeyEnc: string,
  vk: CryptoKey
): Promise<Blob> {
  const fk = await unwrapFileKey(fileKeyEnc, vk);
  const ct = await encryptBytes(fk, data);
  return new Blob([ct as BufferSource], { type: "application/octet-stream" });
}

// --- Paire de cles RSA (partage entre utilisateurs) --------------------------
// Chaque compte possede une paire RSA-OAEP :
//   - cle publique : en clair cote serveur, sert a enrober une cle de fichier
//                    pour un destinataire ;
//   - cle privee   : chiffree par la vaultKey, seul le proprietaire peut
//                    dechiffrer les fichiers qu'on lui partage.

const RSA_PARAMS = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
} as const;

export interface UserKeypair {
  /** Cle publique exportee (SPKI, base64). Stockee en clair. */
  publicKey: string;
  /** Cle privee (PKCS8) chiffree par la vaultKey (base64). */
  encPrivateKey: string;
}

/** Genere la paire RSA d'un compte et chiffre la cle privee avec la vaultKey. */
export async function generateUserKeypair(vk: CryptoKey): Promise<UserKeypair> {
  const pair = await crypto.subtle.generateKey(RSA_PARAMS, true, [
    "encrypt",
    "decrypt",
  ]);
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  return {
    publicKey: bytesToB64(spki),
    encPrivateKey: bytesToB64(await encryptRaw(vk, pkcs8)),
  };
}

export function importPublicKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    b64ToBytes(b64) as BufferSource,
    RSA_PARAMS,
    false,
    ["encrypt"]
  );
}

export async function importEncryptedPrivateKey(
  b64: string,
  vk: CryptoKey
): Promise<CryptoKey> {
  const pkcs8 = await decryptRaw(vk, b64ToBytes(b64));
  return crypto.subtle.importKey("pkcs8", pkcs8 as BufferSource, RSA_PARAMS, false, [
    "decrypt",
  ]);
}

/** Enrobe une cle de fichier avec la cle publique RSA d'un destinataire. */
export async function wrapFileKeyForRecipient(
  fileKeyEnc: string,
  vk: CryptoKey,
  recipientPublicKeyB64: string
): Promise<string> {
  const fk = await unwrapFileKey(fileKeyEnc, vk);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", fk));
  const pub = await importPublicKey(recipientPublicKeyB64);
  const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, raw as BufferSource);
  return bytesToB64(new Uint8Array(wrapped));
}

/** Dechiffre (avec sa cle privee) une cle de fichier recue en partage. */
export async function unwrapSharedFileKey(
  wrappedB64: string,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  const raw = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    b64ToBytes(wrappedB64) as BufferSource
  );
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", true, [
    "encrypt",
    "decrypt",
  ]);
}

// --- Cle de recuperation -----------------------------------------------------
// Un code de recuperation (affiche une seule fois a l'inscription) permet de
// re-deriver une cle qui deverrouille la vaultKey si le mot de passe maitre est
// perdu. La vaultKey reste identique : les fichiers existants restent lisibles.

/** Genere un code de recuperation lisible : 6 groupes de 4 caracteres. */
export function randomRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans O/0/I/1/L ambigus
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return chars.join("").match(/.{1,4}/g)!.join("-");
}
