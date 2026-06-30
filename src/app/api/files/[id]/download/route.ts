import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import db from '@/lib/db';
import { s3, BUCKET } from '@/lib/minio';
import { getSessionUser } from '@/lib/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;

  // Vérifie la propriété ou le partage
  const [owned] = await db.execute<any[]>(
    'SELECT name_encrypted, mime_type_encrypted, storage_key, size_bytes FROM files WHERE id = ? AND owner_id = ? AND is_deleted = FALSE AND is_folder = FALSE',
    [id, user.id]
  );

  let fileRow = owned[0];

  if (!fileRow) {
    // Vérifie si le fichier est partagé avec l'utilisateur
    const [shared] = await db.execute<any[]>(
      `SELECT f.name_encrypted, f.mime_type_encrypted, f.storage_key, f.size_bytes
       FROM shared_files sf
       JOIN files f ON sf.file_id = f.id
       WHERE sf.file_id = ? AND sf.shared_with_id = ? AND f.is_deleted = FALSE`,
      [id, user.id]
    );
    fileRow = shared[0];
  }

  if (!fileRow) {
    return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
  }

  const filename = Buffer.isBuffer(fileRow.name_encrypted)
    ? fileRow.name_encrypted.toString('utf8')
    : String(fileRow.name_encrypted);

  const mimeType = fileRow.mime_type_encrypted
    ? Buffer.isBuffer(fileRow.mime_type_encrypted)
      ? fileRow.mime_type_encrypted.toString('utf8')
      : String(fileRow.mime_type_encrypted)
    : 'application/octet-stream';

  const { Body, ContentLength } = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: fileRow.storage_key })
  );

  if (!Body) {
    return NextResponse.json({ error: 'Fichier introuvable dans le stockage' }, { status: 404 });
  }

  const webStream = Readable.toWeb(Body as Readable) as ReadableStream;

  return new NextResponse(webStream, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      ...(ContentLength ? { 'Content-Length': String(ContentLength) } : {}),
    },
  });
}
