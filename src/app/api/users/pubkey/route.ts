import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/session';

// GET /api/users/pubkey?email=  → cle publique RSA du destinataire d'un partage.
// Reservee aux utilisateurs connectes (necessaire pour enrober une cle de
// fichier a destination de quelqu'un d'autre).
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const email = new URL(request.url).searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'Email manquant' }, { status: 400 });

  const [rows] = await db.execute<any[]>(
    'SELECT id, public_key FROM users WHERE email = ?',
    [email]
  );
  if (!rows.length) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
  }
  if (rows[0].id === user.id) {
    return NextResponse.json({ error: 'Impossible de partager avec soi-même' }, { status: 400 });
  }

  const publicKey = Buffer.isBuffer(rows[0].public_key)
    ? rows[0].public_key.toString('utf8')
    : String(rows[0].public_key);

  return NextResponse.json({ userId: rows[0].id, publicKey });
}
