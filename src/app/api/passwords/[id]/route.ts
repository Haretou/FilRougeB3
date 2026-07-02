import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { logAudit } from '@/lib/audit';

// PATCH /api/passwords/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const [rows] = await db.execute<any[]>(
    'SELECT id FROM passwords WHERE id = ? AND owner_id = ?',
    [id, user.id]
  );
  if (!rows.length) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const fields: string[] = [];
  const values: any[] = [];

  if (body.siteName)  { fields.push('site_name = ?');      values.push(body.siteName); }
  if (body.username !== undefined) { fields.push('username = ?'); values.push(body.username); }
  if (body.password)  { fields.push('password_value = ?'); values.push(body.password); }
  if (body.url !== undefined) { fields.push('url = ?');    values.push(body.url); }
  if (body.notes !== undefined) { fields.push('notes = ?'); values.push(body.notes); }

  if (fields.length) {
    values.push(id);
    await db.execute(`UPDATE passwords SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/passwords/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;

  const [rows] = await db.execute<any[]>(
    'SELECT id FROM passwords WHERE id = ? AND owner_id = ?',
    [id, user.id]
  );
  if (!rows.length) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  await db.execute('DELETE FROM passwords WHERE id = ?', [id]);
  await logAudit(request, user.id, 'PASSWORD_DELETE', 'password', id);
  return NextResponse.json({ ok: true });
}
