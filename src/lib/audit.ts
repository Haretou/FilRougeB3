import { NextRequest } from 'next/server';
import db from './db';

// Journal d'audit des evenements de securite.
//
// Note zero-knowledge : le serveur n'ayant jamais acces aux noms de fichiers en
// clair, le journal ne contient que des METADONNEES (action, IP, user-agent,
// identifiants opaques). Il enregistre QUI fait QUOI et QUAND, sans jamais
// reveler le contenu — tracabilite sans fuite de donnees.

export type AuditAction =
  | 'REGISTER'
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'UPDATE'
  | 'DELETE'
  | 'DELETE_PERMANENT'
  | 'RESTORE'
  | 'SHARE'
  | 'UNSHARE'
  | 'PASSWORD_CREATE'
  | 'PASSWORD_DELETE'
  | 'RECOVER';

/**
 * Enregistre un evenement. Ne leve jamais : un echec de journalisation ne doit
 * pas casser l'action metier.
 */
export async function logAudit(
  request: NextRequest,
  userId: string | null,
  action: AuditAction,
  resourceType?: 'file' | 'folder' | 'share' | 'session' | 'password' | 'user',
  resourceId?: string | null,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
    const userAgent = request.headers.get('user-agent') ?? '';
    await db.execute(
      `INSERT INTO audit_log
        (user_id, action, resource_type, resource_id, ip_address, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        resourceType ?? null,
        resourceId ?? null,
        ip,
        userAgent,
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch (err) {
    console.error('[audit]', err);
  }
}
