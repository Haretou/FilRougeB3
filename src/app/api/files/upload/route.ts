import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import db from '@/lib/db';
import { s3, BUCKET, ensureBucket } from '@/lib/minio';
import { getSessionUser } from '@/lib/session';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const parentFolderId = (formData.get('parentFolderId') as string) ?? null;

  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });

  const fileId = uuidv4();
  const storageKey = `${user.id}/${fileId}/${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await ensureBucket();

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
      ContentLength: buffer.length,
    })
  );

  const nameEncrypted = Buffer.from(file.name, 'utf8');
  const mimeEncrypted = Buffer.from(file.type || 'application/octet-stream', 'utf8');

  await db.execute(
    `INSERT INTO files
      (id, owner_id, parent_folder_id, name_encrypted, mime_type_encrypted,
       size_bytes, storage_key, file_key_encrypted, iv, is_folder)
     VALUES (?, ?, ?, ?, ?, ?, ?, '', '00000000000000000000000000000000', FALSE)`,
    [fileId, user.id, parentFolderId || null, nameEncrypted, mimeEncrypted, buffer.length, storageKey]
  );

  // Mise à jour du stockage utilisé
  await db.execute(
    'UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?',
    [buffer.length, user.id]
  );

  return NextResponse.json(
    {
      id: fileId,
      name: file.name,
      mimeType: file.type,
      sizeBytes: buffer.length,
      isFolder: false,
    },
    { status: 201 }
  );
}
