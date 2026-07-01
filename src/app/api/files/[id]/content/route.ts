import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import db from '@/lib/db';
import { s3, BUCKET } from '@/lib/minio';
import { getSessionUser } from '@/lib/session';

export const maxDuration = 60;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;

  // Verify ownership and get storage_key
  const [rows] = await db.execute<any[]>(
    'SELECT storage_key, size_bytes FROM files WHERE id = ? AND owner_id = ? AND is_deleted = FALSE AND is_folder = FALSE',
    [id, user.id]
  );
  if (!rows.length) {
    return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
  }
  const { storage_key, size_bytes: oldSize } = rows[0];

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: storage_key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
      ContentLength: buffer.length,
    })
  );

  const sizeDiff = buffer.length - Number(oldSize);
  await db.execute('UPDATE files SET size_bytes = ?, updated_at = NOW() WHERE id = ?', [buffer.length, id]);
  await db.execute(
    'UPDATE users SET storage_used_bytes = GREATEST(0, storage_used_bytes + ?) WHERE id = ?',
    [sizeDiff, user.id]
  );

  return NextResponse.json({ ok: true, sizeBytes: buffer.length });
}
