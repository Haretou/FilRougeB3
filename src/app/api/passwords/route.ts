import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { logAudit } from '@/lib/audit';

// GET /api/passwords
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const [rows] = await db.execute<any[]>(
    `SELECT id, site_name, username, password_value, url, notes, created_at, updated_at
     FROM passwords WHERE owner_id = ? ORDER BY site_name ASC`,
    [user.id]
  );

  return NextResponse.json(rows);
}

// POST /api/passwords
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { siteName, username, password, url, notes } = await request.json();

  if (!siteName || !password) {
    return NextResponse.json({ error: 'Site et mot de passe requis' }, { status: 400 });
  }

  const id = uuidv4();

  await db.execute(
    `INSERT INTO passwords (id, owner_id, site_name, username, password_value, url, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, user.id, siteName, username ?? '', password, url ?? '', notes ?? '']
  );

  await logAudit(request, user.id, 'PASSWORD_CREATE', 'password', id);

  return NextResponse.json({ id, siteName, username, url }, { status: 201 });
}
