import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, deleteSession, clearSessionCookie, getSessionUser } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (token) {
    const user = await getSessionUser(request);
    await deleteSession(token).catch(() => {});
    if (user) await logAudit(request, user.id, 'LOGOUT', 'session', null);
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
