import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, deleteSession, clearSessionCookie } from '@/lib/session';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (token) {
    await deleteSession(token).catch(() => {});
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
