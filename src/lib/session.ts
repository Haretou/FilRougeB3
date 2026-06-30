import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { NextRequest, NextResponse } from 'next/server';
import db from './db';

export const COOKIE_NAME = 'safelock_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: string,
  ip: string,
  userAgent: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = uuidv4() + uuidv4();
  const tokenHash = hashToken(token);
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.execute(
    'INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, userId, tokenHash, ip, userAgent, expiresAt]
  );

  return { token, expiresAt };
}

export async function getSessionUser(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);

  const [rows] = await db.execute<any[]>(
    `SELECT
      s.user_id AS id,
      u.email,
      u.name_encrypted,
      u.storage_used_bytes,
      u.storage_limit_bytes
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token_hash = ? AND s.expires_at > NOW()`,
    [tokenHash]
  );

  if (!rows.length) return null;

  const row = rows[0];
  return {
    id: row.id as string,
    email: row.email as string,
    name: Buffer.isBuffer(row.name_encrypted)
      ? row.name_encrypted.toString('utf8')
      : String(row.name_encrypted),
    storageUsed: Number(row.storage_used_bytes),
    storageLimit: Number(row.storage_limit_bytes),
  };
}

export async function deleteSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.execute('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date
): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });
}
