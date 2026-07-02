import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';

// GET /api/auth/recover?email=  → sel de recuperation (comme prelogin).
// Sel factice deterministe pour un email inconnu (anti-enumeration).
export async function GET(request: NextRequest) {
  const email = new URL(request.url).searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'Email manquant' }, { status: 400 });

  const [rows] = await db.execute<any[]>(
    'SELECT recovery_salt FROM users WHERE email = ?',
    [email]
  );

  const recoverySalt = rows.length && rows[0].recovery_salt
    ? rows[0].recovery_salt
    : crypto.createHash('sha256').update(`${email.toLowerCase()}safelock-rec-salt`).digest('hex');

  return NextResponse.json({ recoverySalt });
}

// POST /api/auth/recover  { email, recoveryAuthHash }
// Verifie le code de recuperation et renvoie la vaultKey chiffree par ce code.
export async function POST(request: NextRequest) {
  try {
    const { email, recoveryAuthHash } = await request.json();
    if (!email || !recoveryAuthHash) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    const [rows] = await db.execute<any[]>(
      'SELECT recovery_key_hash, recovery_encrypted_vault_key FROM users WHERE email = ?',
      [email]
    );

    const invalid = () =>
      NextResponse.json({ error: 'Email ou code de récupération incorrect' }, { status: 401 });

    if (!rows.length || !rows[0].recovery_key_hash) return invalid();

    const ok = await bcrypt.compare(recoveryAuthHash, rows[0].recovery_key_hash);
    if (!ok) return invalid();

    const recoveryEncVaultKey = Buffer.isBuffer(rows[0].recovery_encrypted_vault_key)
      ? rows[0].recovery_encrypted_vault_key.toString('utf8')
      : String(rows[0].recovery_encrypted_vault_key);

    return NextResponse.json({ recoveryEncVaultKey });
  } catch (err) {
    console.error('[recover]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
