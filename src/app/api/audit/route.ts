import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/session';

// GET /api/audit  → 100 derniers evenements de securite de l'utilisateur.
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const [rows] = await db.execute<any[]>(
    `SELECT id, action, resource_type, resource_id, ip_address, user_agent, details, created_at
     FROM audit_log WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 100`,
    [user.id]
  );

  const events = rows.map((r) => ({
    id: r.id,
    action: r.action,
    resourceType: r.resource_type,
    resourceId: r.resource_id,
    ip: r.ip_address,
    userAgent: r.user_agent,
    details: typeof r.details === 'string' ? safeParse(r.details) : r.details,
    createdAt: r.created_at,
  }));

  return NextResponse.json(events);
}

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}
