import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/session';

// GET /api/files?parentId=xxx&filter=recent|starred|trash
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get('parentId') ?? null;
  const filter = searchParams.get('filter');

  const cols = `id, name_encrypted, mime_type_encrypted, file_key_encrypted, size_bytes, is_folder, is_starred, is_deleted, created_at, updated_at, parent_folder_id`;
  let query = '';
  const params: any[] = [user.id];

  if (filter === 'starred') {
    query = `SELECT ${cols} FROM files WHERE owner_id = ? AND is_deleted = FALSE AND is_starred = TRUE
             ORDER BY updated_at DESC`;
  } else if (filter === 'trash') {
    query = `SELECT ${cols} FROM files WHERE owner_id = ? AND is_deleted = TRUE
             ORDER BY deleted_at DESC`;
  } else if (filter === 'recent') {
    query = `SELECT ${cols} FROM files WHERE owner_id = ? AND is_deleted = FALSE AND is_folder = FALSE
             ORDER BY updated_at DESC LIMIT 20`;
  } else {
    query = `SELECT ${cols} FROM files WHERE owner_id = ? AND is_deleted = FALSE
             AND parent_folder_id ${parentId ? '= ?' : 'IS NULL'}
             ORDER BY is_folder DESC, created_at DESC`;
    if (parentId) params.push(parentId);
  }

  const [rows] = await db.execute<any[]>(query, params);

  const asStr = (v: any) =>
    v == null ? null : Buffer.isBuffer(v) ? v.toString('utf8') : String(v);

  // On renvoie des blobs chiffres : le front les dechiffre avec la vaultKey.
  const files = rows.map((r) => ({
    id: r.id,
    nameEnc: asStr(r.name_encrypted),
    mimeEnc: asStr(r.mime_type_encrypted),
    fileKeyEnc: asStr(r.file_key_encrypted),
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

  const { nameEnc, fileKeyEnc, parentFolderId } = await request.json();
  if (!nameEnc || !fileKeyEnc) {
    return NextResponse.json({ error: 'Nom chiffré manquant' }, { status: 400 });
  }

  const folderId = uuidv4();

  await db.execute(
    `INSERT INTO files
      (id, owner_id, parent_folder_id, name_encrypted, size_bytes, storage_key, file_key_encrypted, iv, is_folder)
     VALUES (?, ?, ?, ?, 0, '', ?, '00000000000000000000000000000000', TRUE)`,
    [folderId, user.id, parentFolderId ?? null, Buffer.from(nameEnc, 'utf8'), Buffer.from(fileKeyEnc, 'utf8')]
  );

  return NextResponse.json({ id: folderId, isFolder: true }, { status: 201 });
}
