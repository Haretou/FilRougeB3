import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Le mot de passe doit faire au moins 8 caractères' },
        { status: 400 }
      );
    }

    // Check if email already used
    const [existing] = await db.execute<any[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 409 });
    }

    const userId = uuidv4();
    const salt = uuidv4().replace(/-/g, '');
    const passwordHash = await bcrypt.hash(password, 12);
    const nameEncrypted = Buffer.from(name, 'utf8');

    await db.execute(
      `INSERT INTO users
        (id, email, name_encrypted, master_password_hash, salt)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, email, nameEncrypted, passwordHash, salt]
    );

    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const userAgent = request.headers.get('user-agent') ?? '';
    const { token, expiresAt } = await createSession(userId, ip, userAgent);

    const response = NextResponse.json(
      { id: userId, email, name },
      { status: 201 }
    );
    setSessionCookie(response, token, expiresAt);
    return response;
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
