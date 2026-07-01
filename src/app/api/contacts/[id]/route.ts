// src/app/api/contacts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// PATCH /api/contacts/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const [rows] = await db.execute<any[]>(
    'SELECT id FROM contacts WHERE id = ? AND owner_id = ?',
    [id, user.id]
  );
  if (!rows.length) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const fields: string[] = [];
  const values: any[] = [];

  if (body.name?.trim()) { fields.push('name = ?'); values.push(body.name.trim()); }
  if (body.email?.trim()) {
    if (!EMAIL_RE.test(body.email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
    }
    fields.push('email = ?');
    values.push(body.email.trim().toLowerCase());
  }

  if (fields.length) {
    values.push(id);
    try {
      await db.execute(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`, values);
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') {
        return NextResponse.json({ error: 'Ce contact existe déjà' }, { status: 409 });
      }
      throw err;
    }
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/contacts/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;

  const [rows] = await db.execute<any[]>(
    'SELECT id FROM contacts WHERE id = ? AND owner_id = ?',
    [id, user.id]
  );
  if (!rows.length) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  await db.execute('DELETE FROM contacts WHERE id = ?', [id]);
  return NextResponse.json({ ok: true });
}
