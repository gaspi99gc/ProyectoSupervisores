import { db } from '@/lib/db';

let supplyRequestSchemaReady = false;

export async function ensureSupplyRequestSchema() {
    if (supplyRequestSchemaReady) {
        return;
    }

    const { rows } = await db.execute('PRAGMA table_info(supply_requests)');
    const existingColumns = new Set(rows.map((column) => column.name));

    if (!existingColumns.has('status')) {
        await db.execute("ALTER TABLE supply_requests ADD COLUMN status TEXT NOT NULL DEFAULT 'pendiente'");
    }

    if (!existingColumns.has('completed_by')) {
        await db.execute('ALTER TABLE supply_requests ADD COLUMN completed_by TEXT');
    }

    if (!existingColumns.has('completed_at')) {
        await db.execute('ALTER TABLE supply_requests ADD COLUMN completed_at DATETIME');
    }

    supplyRequestSchemaReady = true;
}
