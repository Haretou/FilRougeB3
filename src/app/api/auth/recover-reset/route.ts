import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/session';
import { logAudit } from '@/lib/audit';

// POST /api/auth/recover-reset
//   { email, recoveryAuthHash, newSalt, newAuthHash, newEncVaultKey }
// Le client a deverrouille la vaultKey via le code de recuperation, puis a
// re-enrobe la MEME vaultKey avec un nouveau mot de passe maitre. On verifie a
// nouveau le code, puis on remplace le sel, le hash et la cle de coffre
// chiffree. Les fichiers existants restent lisibles (la vaultKey est inchangee).
export async function POST(request: NextRequest) {
  try {
    const { email, recoveryAuthHash, newSalt, newAuthHash, newEncVaultKey } =
      await request.json();

    if (!email || !recoveryAuthHash || !newSalt || !newAuthHash || !newEncVaultKey) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    const [rows] = await db.execute<any[]>(
      'SELECT id, recovery_key_hash FROM users WHERE email = ?',
      [email]
    );
    if (!rows.length || !rows[0].recovery_key_hash) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });
    }

    const ok = await bcrypt.compare(recoveryAuthHash, rows[0].recovery_key_hash);
    if (!ok) {
      return NextResponse.json({ error: 'Code de récupération incorrect' }, { status: 401 });
    }

    const userId = rows[0].id;
    const passwordHash = await bcrypt.hash(newAuthHash, 12);

    await db.execute(
      'UPDATE users SET salt = ?, master_password_hash = ?, encrypted_vault_key = ? WHERE id = ?',
      [newSalt, passwordHash, Buffer.from(newEncVaultKey, 'utf8'), userId]
    );

    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const userAgent = request.headers.get('user-agent') ?? '';
    const { token, expiresAt } = await createSession(userId, ip, userAgent);
    await logAudit(request, userId, 'RECOVER', 'user', userId);

    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, token, expiresAt);
    return response;
  } catch (err) {
    console.error('[recover-reset]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
