// Tests automatises du coeur cryptographique zero-knowledge.
// Executes en CI (npm test) avec le vrai module src/lib/crypto.ts.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  randomSalt,
  deriveAccount,
  generateVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
  encryptString,
  decryptString,
  encryptBytes,
  decryptBytes,
  generateFileKey,
  wrapFileKey,
  unwrapFileKey,
  generateUserKeypair,
  wrapFileKeyForRecipient,
  importEncryptedPrivateKey,
  unwrapSharedFileKey,
  randomRecoveryCode,
} from "../src/lib/crypto.ts";

const PASSWORD = "MotDePasseMaitre123";

test("deriveAccount est deterministe (login reproductible)", async () => {
  const salt = randomSalt();
  const a = await deriveAccount(PASSWORD, salt);
  const b = await deriveAccount(PASSWORD, salt);
  assert.equal(a.authHash, b.authHash);
});

test("un mauvais mot de passe donne un authHash different", async () => {
  const salt = randomSalt();
  const good = await deriveAccount(PASSWORD, salt);
  const bad = await deriveAccount("mauvais", salt);
  assert.notEqual(good.authHash, bad.authHash);
});

test("vaultKey : wrap/unwrap avec la cle du mot de passe", async () => {
  const salt = randomSalt();
  const { wrapKey } = await deriveAccount(PASSWORD, salt);
  const vk = await generateVaultKey();
  const enc = await wrapVaultKey(vk, wrapKey);

  const { wrapKey: wrapKey2 } = await deriveAccount(PASSWORD, salt);
  const vk2 = await unwrapVaultKey(enc, wrapKey2);

  const secret = "donnee-secrete";
  const ct = await encryptString(vk, secret);
  assert.equal(await decryptString(vk2, ct), secret);
});

test("un mauvais mot de passe ne peut pas deballer la vaultKey", async () => {
  const salt = randomSalt();
  const { wrapKey } = await deriveAccount(PASSWORD, salt);
  const vk = await generateVaultKey();
  const enc = await wrapVaultKey(vk, wrapKey);

  const { wrapKey: badWrap } = await deriveAccount("mauvais", salt);
  await assert.rejects(() => unwrapVaultKey(enc, badWrap));
});

test("fichier : chiffrement/dechiffrement du contenu via une file key", async () => {
  const vk = await generateVaultKey();
  const fk = await generateFileKey();
  const fileKeyEnc = await wrapFileKey(fk, vk);

  const data = new TextEncoder().encode("contenu confidentiel 🔒");
  const ct = await encryptBytes(fk, data);

  const fk2 = await unwrapFileKey(fileKeyEnc, vk);
  const pt = await decryptBytes(fk2, ct);
  assert.equal(new TextDecoder().decode(pt), "contenu confidentiel 🔒");
});

test("partage RSA : le destinataire dechiffre, personne d'autre", async () => {
  // Emetteur A : possede un fichier
  const vkA = await generateVaultKey();
  const fk = await generateFileKey();
  const fileKeyEncA = await wrapFileKey(fk, vkA);
  const nameEnc = await encryptString(fk, "rapport.pdf");

  // Destinataire B : paire de cles RSA
  const vkB = await generateVaultKey();
  const kp = await generateUserKeypair(vkB);

  // A enrobe la file key pour B avec la cle publique de B
  const shared = await wrapFileKeyForRecipient(fileKeyEncA, vkA, kp.publicKey);

  // B deballe sa cle privee puis la file key, et lit le nom
  const privB = await importEncryptedPrivateKey(kp.encPrivateKey, vkB);
  const fkForB = await unwrapSharedFileKey(shared, privB);
  assert.equal(await decryptString(fkForB, nameEnc), "rapport.pdf");

  // Un tiers (autre cle privee) ne peut PAS deballer
  const vkC = await generateVaultKey();
  const kpC = await generateUserKeypair(vkC);
  const privC = await importEncryptedPrivateKey(kpC.encPrivateKey, vkC);
  await assert.rejects(() => unwrapSharedFileKey(shared, privC));
});

test("recuperation : le code redonne la meme vaultKey", async () => {
  const vk = await generateVaultKey();

  // Setup a l'inscription
  const recSalt = randomSalt();
  const code = randomRecoveryCode();
  const rec = await deriveAccount(code, recSalt);
  const recEnc = await wrapVaultKey(vk, rec.wrapKey);

  // Recuperation : re-derive depuis le code, deballe la meme vaultKey
  const rec2 = await deriveAccount(code, recSalt);
  const vkRecovered = await unwrapVaultKey(recEnc, rec2.wrapKey);

  // Re-enrobe avec un nouveau mot de passe : les donnees restent lisibles
  const newSalt = randomSalt();
  const next = await deriveAccount("NouveauMotDePasse456", newSalt);
  const newEnc = await wrapVaultKey(vkRecovered, next.wrapKey);
  const vkFinal = await unwrapVaultKey(newEnc, next.wrapKey);

  const probe = await encryptString(vk, "test");
  assert.equal(await decryptString(vkFinal, probe), "test");
});

test("format du code de recuperation", () => {
  const code = randomRecoveryCode();
  assert.match(code, /^([A-Z0-9]{4}-){5}[A-Z0-9]{4}$/);
});
