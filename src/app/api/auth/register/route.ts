import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/session';
import { logAudit } from '@/lib/audit';

// Inscription zero-knowledge. Tout est derive/chiffre cote client ; le serveur
// ne recoit que des elements opaques :
//   - salt / authHash            : sel Argon2id + « équivalent mot de passe »
//   - encVaultKey                : cle de coffre chiffree par la cle du mdp maitre
//   - nameEnc                    : nom d'affichage chiffre par la cle de coffre
//   - publicKey / encPrivateKey  : paire RSA (privee chiffree par la vaultKey)
//   - recovery*                  : de quoi retrouver la vaultKey via un code
// Le mot de passe maitre et le code de recuperation ne sont JAMAIS transmis.
export async function POST(request: NextRequest) {
  try {
    const {
      email,
      salt,
      authHash,
      encVaultKey,
      nameEnc,
      publicKey,
      encPrivateKey,
      recoverySalt,
      recoveryAuthHash,
      recoveryEncVaultKey,
    } = await request.json();

    if (
      !email || !salt || !authHash || !encVaultKey || !nameEnc ||
      !publicKey || !encPrivateKey ||
      !recoverySalt || !recoveryAuthHash || !recoveryEncVaultKey
    ) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    const [existing] = await db.execute<any[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 409 });
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(authHash, 12);
    const recoveryHash = await bcrypt.hash(recoveryAuthHash, 12);

    await db.execute(
      `INSERT INTO users
        (id, email, name_encrypted, master_password_hash, salt,
         encrypted_vault_key, public_key, encrypted_private_key,
         recovery_key_hash, recovery_salt, recovery_encrypted_vault_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        email,
        Buffer.from(nameEnc, 'utf8'),
        passwordHash,
        salt,
        Buffer.from(encVaultKey, 'utf8'),
        Buffer.from(publicKey, 'utf8'),
        Buffer.from(encPrivateKey, 'utf8'),
        recoveryHash,
        recoverySalt,
        Buffer.from(recoveryEncVaultKey, 'utf8'),
      ]
    );

    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const userAgent = request.headers.get('user-agent') ?? '';
    const { token, expiresAt } = await createSession(userId, ip, userAgent);
    await logAudit(request, userId, 'REGISTER', 'user', userId);

    const response = NextResponse.json({ id: userId, email }, { status: 201 });
    setSessionCookie(response, token, expiresAt);
    return response;
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
