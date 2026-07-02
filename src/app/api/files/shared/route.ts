import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/session';

// GET /api/files/shared  → fichiers partages AVEC l'utilisateur connecte.
// La cle de chaque fichier (file_key_encrypted) a ete enrobee avec la cle
// publique RSA du destinataire : lui seul peut la dechiffrer avec sa cle privee.
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const [rows] = await db.execute<any[]>(
    `SELECT f.id, f.name_encrypted, f.mime_type_encrypted, f.size_bytes,
            sf.file_key_encrypted AS shared_key, sf.permission, sf.created_at,
            owner.email AS shared_by
     FROM shared_files sf
     JOIN files f ON sf.file_id = f.id
     JOIN users owner ON sf.shared_by_id = owner.id
     WHERE sf.shared_with_id = ? AND f.is_deleted = FALSE
       AND (sf.expires_at IS NULL OR sf.expires_at > NOW())
     ORDER BY sf.created_at DESC`,
    [user.id]
  );

  const asStr = (v: any) =>
    v == null ? null : Buffer.isBuffer(v) ? v.toString('utf8') : String(v);

  const files = rows.map((r) => ({
    id: r.id,
    nameEnc: asStr(r.name_encrypted),
    mimeEnc: asStr(r.mime_type_encrypted),
    // Cle du fichier enrobee RSA pour le destinataire (base64).
    fileKeyEncRsa: asStr(r.shared_key),
    sizeBytes: Number(r.size_bytes),
    permission: r.permission,
    sharedBy: r.shared_by,
    createdAt: r.created_at,
  }));

  return NextResponse.json(files);
}
