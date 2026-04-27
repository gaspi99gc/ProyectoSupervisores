import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Load .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://ivbcxygauvzvonbsrzfa.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupLicensesTable() {
    try {
        console.log('Creating licenses table via Supabase...');
        
        // Check if table exists
        const { data: existingTables, error: checkError } = await supabase
            .from('licenses')
            .select('id')
            .limit(1);
            
        if (checkError && checkError.code === '42P01') {
            // Table doesn't exist, need to create it
            console.log('Table does not exist. Please run this SQL in Supabase SQL Editor:');
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
        } else if (checkError) {
            console.error('Error checking table:', checkError);
        } else {
            console.log('✅ licenses table already exists');
        }
    } catch (error) {
        console.error('Setup error:', error);
    }
}

setupLicensesTable();
