import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { logAudit } from '@/lib/audit';

// GET /api/files/[id]/share  — liste les partages d'un fichier
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;

  // Seul le propriétaire peut voir les partages
  const [owned] = await db.execute<any[]>(
    'SELECT id FROM files WHERE id = ? AND owner_id = ?',
    [id, user.id]
  );
  if (!owned.length) {
    return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
  }

  const [rows] = await db.execute<any[]>(
    `SELECT sf.id, sf.permission, sf.expires_at, sf.created_at,
            u.email AS shared_with_email, u.name_encrypted AS shared_with_name
     FROM shared_files sf
     JOIN users u ON sf.shared_with_id = u.id
     WHERE sf.file_id = ?`,
    [id]
  );

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      permission: r.permission,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      sharedWith: {
        email: r.shared_with_email,
        name: Buffer.isBuffer(r.shared_with_name)
          ? r.shared_with_name.toString('utf8')
          : String(r.shared_with_name),
      },
    }))
  );
}

// POST /api/files/[id]/share  — partage un fichier avec un utilisateur
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;
  const { email, permission = 'read', expiresAt, fileKeyEncrypted } = await request.json();

  if (!email) {
    return NextResponse.json({ error: 'Email manquant' }, { status: 400 });
  }

  // La cle du fichier, enrobee avec la cle publique RSA du destinataire, est
  // indispensable : sans elle il ne pourrait pas dechiffrer le fichier.
  if (!fileKeyEncrypted) {
    return NextResponse.json({ error: 'Clé de partage manquante' }, { status: 400 });
  }

  if (!['read', 'write'].includes(permission)) {
    return NextResponse.json({ error: 'Permission invalide' }, { status: 400 });
  }

  // Vérifie la propriété du fichier
  const [owned] = await db.execute<any[]>(
    'SELECT id, is_folder FROM files WHERE id = ? AND owner_id = ? AND is_deleted = FALSE',
    [id, user.id]
  );
  if (!owned.length) {
    return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
  }
  if (owned[0].is_folder) {
    return NextResponse.json({ error: 'Le partage de dossier n\'est pas supporté' }, { status: 400 });
  }

  // Trouve l'utilisateur destinataire
  const [target] = await db.execute<any[]>(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );
  if (!target.length) {
    return NextResponse.json(
      { error: 'Utilisateur introuvable' },
      { status: 404 }
    );
  }

  if (target[0].id === user.id) {
    return NextResponse.json(
      { error: 'Impossible de partager avec soi-même' },
      { status: 400 }
    );
  }

  const sharedKey = Buffer.from(fileKeyEncrypted, 'utf8');

  // Vérifie si déjà partagé
  const [existing] = await db.execute<any[]>(
    'SELECT id FROM shared_files WHERE file_id = ? AND shared_with_id = ?',
    [id, target[0].id]
  );

  if (existing.length) {
    await db.execute(
      'UPDATE shared_files SET permission = ?, expires_at = ?, file_key_encrypted = ? WHERE file_id = ? AND shared_with_id = ?',
      [permission, expiresAt ?? null, sharedKey, id, target[0].id]
    );
    await logAudit(request, user.id, 'SHARE', 'file', id, { with: email, updated: true });
    return NextResponse.json({ ok: true, updated: true });
  }

  await db.execute(
    `INSERT INTO shared_files
      (id, file_id, shared_by_id, shared_with_id, file_key_encrypted, permission, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), id, user.id, target[0].id, sharedKey, permission, expiresAt ?? null]
  );

  await logAudit(request, user.id, 'SHARE', 'file', id, { with: email });

  return NextResponse.json({ ok: true }, { status: 201 });
}

// DELETE /api/files/[id]/share  — révoque le partage avec un utilisateur
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;
  const { email } = await request.json();

  const [owned] = await db.execute<any[]>(
    'SELECT id FROM files WHERE id = ? AND owner_id = ?',
    [id, user.id]
  );
  if (!owned.length) {
    return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
  }

  const [target] = await db.execute<any[]>(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );
  if (!target.length) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
  }

  await db.execute(
    'DELETE FROM shared_files WHERE file_id = ? AND shared_with_id = ?',
    [id, target[0].id]
  );

  await logAudit(request, user.id, 'UNSHARE', 'file', id, { with: email });

  return NextResponse.json({ ok: true });
}
