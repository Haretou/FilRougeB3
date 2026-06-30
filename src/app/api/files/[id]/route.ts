import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/session';

// GET /api/files/[id]  — métadonnées d'un fichier
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;

  const [rows] = await db.execute<any[]>(
    'SELECT * FROM files WHERE id = ? AND owner_id = ? AND is_deleted = FALSE',
    [id, user.id]
  );

  if (!rows.length) {
    return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
  }

  const r = rows[0];
  return NextResponse.json({
    id: r.id,
    name: Buffer.isBuffer(r.name_encrypted)
      ? r.name_encrypted.toString('utf8')
      : String(r.name_encrypted),
    sizeBytes: Number(r.size_bytes),
    isFolder: Boolean(r.is_folder),
    isStarred: Boolean(r.is_starred),
    parentFolderId: r.parent_folder_id ?? null,
    createdAt: r.created_at,
  });
}

// PATCH /api/files/[id]  — rename, star, déplacer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Vérifie la propriété
  const [rows] = await db.execute<any[]>(
    'SELECT id FROM files WHERE id = ? AND owner_id = ? AND is_deleted = FALSE',
    [id, user.id]
  );
  if (!rows.length) {
    return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
  }

  if (typeof body.isStarred === 'boolean') {
    await db.execute('UPDATE files SET is_starred = ? WHERE id = ?', [
      body.isStarred,
      id,
    ]);
  }

  if (typeof body.name === 'string') {
    const nameEncrypted = Buffer.from(body.name, 'utf8');
    await db.execute('UPDATE files SET name_encrypted = ? WHERE id = ?', [
      nameEncrypted,
      id,
    ]);
  }

  if (body.parentFolderId !== undefined) {
    await db.execute('UPDATE files SET parent_folder_id = ? WHERE id = ?', [
      body.parentFolderId ?? null,
      id,
    ]);
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/files/[id]  — suppression douce
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;

  const [rows] = await db.execute<any[]>(
    'SELECT id, size_bytes FROM files WHERE id = ? AND owner_id = ? AND is_deleted = FALSE',
    [id, user.id]
  );
  if (!rows.length) {
    return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
  }

  await db.execute(
    'UPDATE files SET is_deleted = TRUE, deleted_at = NOW() WHERE id = ?',
    [id]
  );

  await db.execute(
    'UPDATE users SET storage_used_bytes = GREATEST(0, storage_used_bytes - ?) WHERE id = ?',
    [Number(rows[0].size_bytes), user.id]
  );

  return NextResponse.json({ ok: true });
}
