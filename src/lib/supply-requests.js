import { db } from '@/lib/db';

let supplyRequestSchemaReady = false;

const DEFAULT_PROVIDERS = [
    'Proveedor General',
    'Proveedor Express',
    'Proveedor Mayorista',
];

export async function ensureSupplyRequestSchema() {
    if (supplyRequestSchemaReady) {
        return;
    }

    await db.execute(`
        CREATE TABLE IF NOT EXISTS providers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            active BOOLEAN DEFAULT 1
        )
    `);

    const { rows: providerRows } = await db.execute('SELECT COUNT(*) as count FROM providers');
    if (Number(providerRows?.[0]?.count || 0) === 0) {
        for (const providerName of DEFAULT_PROVIDERS) {
            await db.execute({
                sql: 'INSERT INTO providers (name, active) VALUES (?, 1)',
                args: [providerName]
            });
        }
    }

    const { rows } = await db.execute('PRAGMA table_info(supply_requests)');
    const existingColumns = new Set(rows.map((column) => column.name));

    if (!existingColumns.has('status')) {
        await db.execute("ALTER TABLE supply_requests ADD COLUMN status TEXT NOT NULL DEFAULT 'pendiente'");
    }

    if (!existingColumns.has('urgent')) {
        await db.execute('ALTER TABLE supply_requests ADD COLUMN urgent BOOLEAN DEFAULT 0');
    }

    if (!existingColumns.has('provider_id')) {
        await db.execute('ALTER TABLE supply_requests ADD COLUMN provider_id INTEGER REFERENCES providers(id)');
    }

    if (!existingColumns.has('completed_by')) {
        await db.execute('ALTER TABLE supply_requests ADD COLUMN completed_by TEXT');
    }

    if (!existingColumns.has('completed_at')) {
        await db.execute('ALTER TABLE supply_requests ADD COLUMN completed_at DATETIME');
    }

    await db.execute("UPDATE supply_requests SET status = 'cerrado' WHERE status = 'ok'");

    supplyRequestSchemaReady = true;
}
