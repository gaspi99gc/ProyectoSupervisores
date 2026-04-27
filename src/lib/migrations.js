import { db } from './db';

const MIGRATIONS = [
    {
        id: '001_create_licenses_table',
        description: 'Create licenses table for employee leave management',
        sql: `
            CREATE TABLE IF NOT EXISTS licenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL REFERENCES employees(id),
                type TEXT NOT NULL CHECK(type IN ('vacaciones', 'enfermedad', 'maternidad', 'paternidad', 'psiquiatrica', 'sin_goce')),
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                notes TEXT,
                status TEXT NOT NULL DEFAULT 'activa' CHECK(status IN ('activa', 'finalizada', 'cancelada')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_licenses_employee_id ON licenses(employee_id);
            CREATE INDEX IF NOT EXISTS idx_licenses_start_date ON licenses(start_date);
            CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
        `
    }
];

export async function runMigrations() {
    try {
        // Create migrations tracking table if it doesn't exist
        await db.execute(`
            CREATE TABLE IF NOT EXISTS migrations (
                id TEXT PRIMARY KEY,
                description TEXT,
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Check which migrations have already been executed
        const { rows: executedMigrations } = await db.execute('SELECT id FROM migrations');
        const executedIds = new Set(executedMigrations.map(row => row.id));
        
        // Run pending migrations
        for (const migration of MIGRATIONS) {
            if (!executedIds.has(migration.id)) {
                console.log(`Running migration: ${migration.id} - ${migration.description}`);
                
                // Execute the migration SQL
                await db.execute(migration.sql);
                
                // Record that this migration was executed
                await db.execute({
                    sql: 'INSERT INTO migrations (id, description) VALUES (?, ?)',
                    args: [migration.id, migration.description]
                });
                
                console.log(`Migration ${migration.id} completed successfully`);
            } else {
                console.log(`Migration ${migration.id} already executed, skipping`);
            }
        }
        
        console.log('All migrations completed successfully');
    } catch (error) {
        console.error('Error running migrations:', error);
        throw error;
    }
}
