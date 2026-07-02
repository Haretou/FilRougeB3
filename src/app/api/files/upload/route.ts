import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import db from '@/lib/db';
import { s3, BUCKET, ensureBucket } from '@/lib/minio';
import { getSessionUser } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export const maxDuration = 60;

// Le contenu recu est DEJA chiffre cote client (blob opaque). Le serveur ne
// voit ni le fichier, ni son nom, ni son type.
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const nameEnc = formData.get('nameEnc') as string | null;
  const mimeEnc = formData.get('mimeEnc') as string | null;
  const fileKeyEnc = formData.get('fileKeyEnc') as string | null;
  const sizeBytes = Number(formData.get('sizeBytes') ?? 0);
  const parentFolderId = (formData.get('parentFolderId') as string) ?? null;

  if (!file || !nameEnc || !fileKeyEnc) {
    return NextResponse.json({ error: 'Données chiffrées manquantes' }, { status: 400 });
  }

  const fileId = uuidv4();
  // La cle de stockage ne contient aucune info en clair (pas le nom du fichier).
  const storageKey = `${user.id}/${fileId}.enc`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await ensureBucket();

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: 'application/octet-stream',
      ContentLength: buffer.length,
    })
  );

  await db.execute(
    `INSERT INTO files
      (id, owner_id, parent_folder_id, name_encrypted, mime_type_encrypted,
       size_bytes, storage_key, file_key_encrypted, iv, is_folder)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, '00000000000000000000000000000000', FALSE)`,
    [
      fileId,
      user.id,
      parentFolderId || null,
      Buffer.from(nameEnc, 'utf8'),
      mimeEnc ? Buffer.from(mimeEnc, 'utf8') : null,
      sizeBytes,
      storageKey,
      Buffer.from(fileKeyEnc, 'utf8'),
    ]
  );

  await db.execute(
    'UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?',
    [sizeBytes, user.id]
  );

  await logAudit(request, user.id, 'UPLOAD', 'file', fileId, { sizeBytes });

  return NextResponse.json({ id: fileId, sizeBytes, isFolder: false }, { status: 201 });
}
