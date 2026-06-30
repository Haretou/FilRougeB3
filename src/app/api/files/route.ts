import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/session';

// GET /api/files?parentId=xxx  — liste les fichiers/dossiers
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get('parentId') ?? null;

  const [rows] = await db.execute<any[]>(
    `SELECT
      id, name_encrypted, mime_type_encrypted,
      size_bytes, is_folder, is_starred, is_deleted,
      created_at, updated_at, parent_folder_id
     FROM files
     WHERE owner_id = ?
       AND is_deleted = FALSE
       AND parent_folder_id ${parentId ? '= ?' : 'IS NULL'}
     ORDER BY is_folder DESC, created_at DESC`,
    parentId ? [user.id, parentId] : [user.id]
  );

  const files = rows.map((r) => ({
    id: r.id,
    name: Buffer.isBuffer(r.name_encrypted)
      ? r.name_encrypted.toString('utf8')
      : String(r.name_encrypted),
    mimeType: r.mime_type_encrypted
      ? Buffer.isBuffer(r.mime_type_encrypted)
        ? r.mime_type_encrypted.toString('utf8')
        : String(r.mime_type_encrypted)
      : null,
    sizeBytes: Number(r.size_bytes),
    isFolder: Boolean(r.is_folder),
    isStarred: Boolean(r.is_starred),
    parentFolderId: r.parent_folder_id ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return NextResponse.json(files);
}

// POST /api/files  — crée un dossier
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { name, parentFolderId } = await request.json();
  if (!name) return NextResponse.json({ error: 'Nom manquant' }, { status: 400 });

  const folderId = uuidv4();
  const nameEncrypted = Buffer.from(name, 'utf8');

  await db.execute(
    `INSERT INTO files
      (id, owner_id, parent_folder_id, name_encrypted, size_bytes, storage_key, file_key_encrypted, iv, is_folder)
     VALUES (?, ?, ?, ?, 0, '', '', '00000000000000000000000000000000', TRUE)`,
    [folderId, user.id, parentFolderId ?? null, nameEncrypted]
  );

  return NextResponse.json({ id: folderId, name, isFolder: true }, { status: 201 });
}
