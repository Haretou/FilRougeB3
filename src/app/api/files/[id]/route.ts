import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { logAudit } from '@/lib/audit';

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
  const asStr = (v: any) =>
    v == null ? null : Buffer.isBuffer(v) ? v.toString('utf8') : String(v);
  return NextResponse.json({
    id: r.id,
    nameEnc: asStr(r.name_encrypted),
    mimeEnc: asStr(r.mime_type_encrypted),
    fileKeyEnc: asStr(r.file_key_encrypted),
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

  if (typeof body.nameEnc === 'string') {
    await db.execute('UPDATE files SET name_encrypted = ? WHERE id = ?', [
      Buffer.from(body.nameEnc, 'utf8'),
      id,
    ]);
  }

  if (body.restore === true) {
    await db.execute('UPDATE files SET is_deleted = FALSE, deleted_at = NULL WHERE id = ?', [id]);
    await logAudit(request, user.id, 'RESTORE', 'file', id);
  }

  if ('parentFolderId' in body) {
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

  await logAudit(request, user.id, 'DELETE', 'file', id);

  return NextResponse.json({ ok: true });
}
