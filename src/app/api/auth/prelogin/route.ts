import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// Renvoie le sel Argon2id de l'utilisateur pour permettre au client de deriver
// sa cle avant de s'authentifier. Le sel n'est pas secret.
// Pour un email inconnu, on renvoie un sel deterministe factice : les reponses
// sont indiscernables, ce qui evite l'enumeration des comptes.
export async function GET(request: NextRequest) {
  const email = new URL(request.url).searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'Email manquant' }, { status: 400 });
  }

  const [rows] = await db.execute<any[]>(
    'SELECT salt FROM users WHERE email = ?',
    [email]
  );

  const salt = rows.length
    ? rows[0].salt
    : crypto
        .createHash('sha256')
        .update(`${email.toLowerCase()}safelock-dummy-salt`)
        .digest('hex');

  return NextResponse.json({ salt });
}
