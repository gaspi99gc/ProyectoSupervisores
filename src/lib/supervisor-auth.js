import { db } from '@/lib/db';

let authColumnsReady = false;

export async function ensureSupervisorAuthColumns() {
    if (authColumnsReady) {
        return;
    }

    const { rows } = await db.execute('PRAGMA table_info(supervisors)');
    const existingColumns = new Set(rows.map((column) => column.name));
    const alterStatements = [];

    if (!existingColumns.has('password_hash')) {
        alterStatements.push('ALTER TABLE supervisors ADD COLUMN password_hash TEXT');
    }

    if (!existingColumns.has('login_enabled')) {
        alterStatements.push('ALTER TABLE supervisors ADD COLUMN login_enabled INTEGER NOT NULL DEFAULT 1');
    }

    if (!existingColumns.has('password_updated_at')) {
        alterStatements.push('ALTER TABLE supervisors ADD COLUMN password_updated_at DATETIME');
    }

    for (const statement of alterStatements) {
        await db.execute(statement);
    }

    authColumnsReady = true;
}
