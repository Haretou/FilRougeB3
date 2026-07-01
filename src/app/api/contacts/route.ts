// src/app/api/contacts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/contacts
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const [rows] = await db.execute<any[]>(
    'SELECT id, name, email, created_at FROM contacts WHERE owner_id = ? ORDER BY name ASC',
    [user.id]
  );

  return NextResponse.json(rows);
}

// POST /api/contacts
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { name, email } = await request.json();

  if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
  if (!email?.trim() || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
  }

  const id = uuidv4();

  try {
    await db.execute(
      'INSERT INTO contacts (id, owner_id, name, email) VALUES (?, ?, ?, ?)',
      [id, user.id, name.trim(), email.trim().toLowerCase()]
    );
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Ce contact existe déjà' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ id, name: name.trim(), email: email.trim().toLowerCase() }, { status: 201 });
}
