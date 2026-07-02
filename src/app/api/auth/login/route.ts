import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/session';
import { logAudit } from '@/lib/audit';

// Connexion zero-knowledge : le client a d'abord recupere son sel (/prelogin),
// derive sa cle et envoie authHash. Le serveur verifie authHash et renvoie la
// cle de coffre chiffree que seul le client peut dechiffrer.
export async function POST(request: NextRequest) {
  try {
    const { email, authHash } = await request.json();

    if (!email || !authHash) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    const [rows] = await db.execute<any[]>(
      'SELECT id, email, name_encrypted, master_password_hash, encrypted_vault_key FROM users WHERE email = ?',
      [email]
    );

    if (!rows.length) {
      await logAudit(request, null, 'LOGIN_FAILED', 'user', null, { email });
      return NextResponse.json(
        { error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    const user = rows[0];
    const valid = await bcrypt.compare(authHash, user.master_password_hash);

    if (!valid) {
      await logAudit(request, user.id, 'LOGIN_FAILED', 'user', user.id);
      return NextResponse.json(
        { error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    const encVaultKey = Buffer.isBuffer(user.encrypted_vault_key)
      ? user.encrypted_vault_key.toString('utf8')
      : String(user.encrypted_vault_key);
    const nameEnc = Buffer.isBuffer(user.name_encrypted)
      ? user.name_encrypted.toString('utf8')
      : String(user.name_encrypted);

    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const userAgent = request.headers.get('user-agent') ?? '';
    const { token, expiresAt } = await createSession(user.id, ip, userAgent);
    await logAudit(request, user.id, 'LOGIN', 'session', null);

    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      encVaultKey,
      nameEnc,
    });
    setSessionCookie(response, token, expiresAt);
    return response;
  } catch (err) {
    console.error('[login]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
