import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    const [rows] = await db.execute<any[]>(
      'SELECT id, email, name_encrypted, master_password_hash FROM users WHERE email = ?',
      [email]
    );

    if (!rows.length) {
      return NextResponse.json(
        { error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.master_password_hash);

    if (!valid) {
      return NextResponse.json(
        { error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    const name = Buffer.isBuffer(user.name_encrypted)
      ? user.name_encrypted.toString('utf8')
      : String(user.name_encrypted);

    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const userAgent = request.headers.get('user-agent') ?? '';
    const { token, expiresAt } = await createSession(user.id, ip, userAgent);

    const response = NextResponse.json({ id: user.id, email: user.email, name });
    setSessionCookie(response, token, expiresAt);
    return response;
  } catch (err) {
    console.error('[login]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
