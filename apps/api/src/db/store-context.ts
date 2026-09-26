import { NotFoundException } from '@nestjs/common';
import { type Database, stores, eq } from '@repo/db';

/** Either the root client or a transaction handle — both expose the same query API. */
export type DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Looks up the tenant that owns a store, so tenant_id on every write matches
 * the store's real owner instead of a hardcoded value.
 */
export async function resolveTenantId(db: Database, storeId: string): Promise<string> {
  const store = await db.query.stores.findFirst({
    where: eq(stores.id, storeId),
    columns: { tenantId: true },
  });
  if (!store) {
    throw new NotFoundException(`Store '${storeId}' not found`);
  }
  return store.tenantId;
}
