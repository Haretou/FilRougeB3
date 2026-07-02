import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import db from '@/lib/db';
import { s3, BUCKET } from '@/lib/minio';
import { getSessionUser } from '@/lib/session';
import { logAudit } from '@/lib/audit';

// DELETE /api/files/[id]/permanent — suppression définitive
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;

  const [rows] = await db.execute<any[]>(
    'SELECT storage_key, size_bytes, is_folder FROM files WHERE id = ? AND owner_id = ? AND is_deleted = TRUE',
    [id, user.id]
  );

  if (!rows.length) {
    return NextResponse.json({ error: 'Fichier introuvable dans la corbeille' }, { status: 404 });
  }

  const file = rows[0];

  if (!file.is_folder && file.storage_key) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: file.storage_key })).catch(() => {});
  }

  await db.execute('DELETE FROM files WHERE id = ?', [id]);

  await logAudit(request, user.id, 'DELETE_PERMANENT', file.is_folder ? 'folder' : 'file', id);

  return NextResponse.json({ ok: true });
}
