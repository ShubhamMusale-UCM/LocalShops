import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { redactSensitiveObject } from './logger';

let auditTableInitialized = false;

async function ensureAuditTable() {
  if (auditTableInitialized) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      changes JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id, created_at DESC)
  `);
  auditTableInitialized = true;
}

export async function recordAuditLog(params: {
  actorId: string;
  actorRole?: string;
  action: string;
  entityType: 'SHOP' | 'ORDER' | 'PRODUCT' | 'USER';
  entityId: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await ensureAuditTable();
    const safeChanges = redactSensitiveObject(params.changes || params.metadata || {});
    await prisma.$executeRawUnsafe(
      `INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, changes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())`,
      randomUUID(),
      params.actorId,
      params.actorRole || 'SELLER',
      params.action,
      params.entityType,
      params.entityId,
      JSON.stringify(safeChanges)
    );
  } catch (e) {
    console.error('Audit log write failed:', e);
  }
}

export async function getEntityAuditLogs(entityType: string, entityId: string, limit = 50) {
  await ensureAuditTable();
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT id, actor_id AS "actorId", actor_role AS "actorRole", action, entity_type AS "entityType", entity_id AS "entityId", changes, changes AS "metadata", created_at AS "createdAt"
     FROM audit_logs
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    entityType,
    entityId,
    limit
  );
  return rows || [];
}
