import { supabase } from './db';

export async function runMigrations() {
    try {
        // Check if licenses table exists by trying to query it
        const { error } = await supabase
            .from('licenses')
            .select('id')
            .limit(1);
        
        if (error && error.code === '42P01') {
            console.log('licenses table does not exist. Please create it manually in Supabase SQL Editor:');
            console.log(`
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

CREATE INDEX IF NOT EXISTS idx_licenses_employee_id ON licenses(employee_id);
CREATE INDEX IF NOT EXISTS idx_licenses_start_date ON licenses(start_date);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
            `);
            throw new Error('licenses table does not exist. Run the SQL above in Supabase SQL Editor.');
        }
        
        console.log('Database schema verified');
    } catch (error) {
        console.error('Migration error:', error.message);
        throw error;
    }
}
