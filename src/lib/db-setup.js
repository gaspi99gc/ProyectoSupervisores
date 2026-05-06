import fs from 'fs';
import path from 'path';

let setupPromise = null;

function splitStatements(sql) {
    return sql
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean);
}

export async function ensureDatabaseSetup(pool) {
    if (setupPromise) {
        return setupPromise;
    }

    setupPromise = (async () => {
        const schemaPath = path.join(process.cwd(), 'src/lib/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        const statements = splitStatements(schemaSql);

        for (const statement of statements) {
            await pool.query(statement);
        }

        await pool.query(`
            INSERT INTO providers (name, active)
            VALUES
                ('Proveedor General', true),
                ('Proveedor Express', true),
                ('Proveedor Mayorista', true)
            ON CONFLICT (name) DO NOTHING
        `);

        await pool.query(`
            UPDATE supply_requests
            SET status = 'cerrado'
            WHERE status = 'ok'
        `);

        await pool.query(`
            UPDATE supply_requests
            SET status = 'revisado'
            WHERE status IN ('en_gestion', 'pedido_proveedor', 'recibido')
        `);
    })();

    return setupPromise;
}
