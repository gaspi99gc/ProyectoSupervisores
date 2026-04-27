import pkg from 'pg';
const { Client } = pkg;

async function setupSupabase() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        console.log('✅ Connected to Supabase PostgreSQL');
        
        // Create execute_sql function if it doesn't exist
        await client.query(`
            CREATE OR REPLACE FUNCTION execute_sql(query_text TEXT, query_params JSONB DEFAULT '[]'::JSONB)
            RETURNS JSONB AS $$
            DECLARE
                result JSONB;
            BEGIN
                EXECUTE query_text 
                USING (SELECT ARRAY_AGG(value) FROM JSONB_ARRAY_ELEMENTS(query_params))
                INTO result;
                
                RETURN result;
            EXCEPTION WHEN OTHERS THEN
                RAISE EXCEPTION '%', SQLERRM;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
        `);
        console.log('✅ execute_sql function created');
        
        // Create licenses table
        await client.query(`
            CREATE TABLE IF NOT EXISTS licenses (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL REFERENCES employees(id),
                type TEXT NOT NULL CHECK(type IN ('vacaciones', 'enfermedad', 'maternidad', 'paternidad', 'psiquiatrica', 'sin_goce')),
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                notes TEXT,
                status TEXT NOT NULL DEFAULT 'activa' CHECK(status IN ('activa', 'finalizada', 'cancelada')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ licenses table created');
        
        // Create indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_licenses_employee_id ON licenses(employee_id);
            CREATE INDEX IF NOT EXISTS idx_licenses_start_date ON licenses(start_date);
            CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
        `);
        console.log('✅ indexes created');
        
        // Create migrations tracking table
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id TEXT PRIMARY KEY,
                description TEXT,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ migrations table created');
        
        console.log('\n🎉 All setup complete!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await client.end();
    }
}

setupSupabase();
