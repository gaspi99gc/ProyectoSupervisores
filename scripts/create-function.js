import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function createExecuteSqlFunction() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        console.log('Connected to database');
        
        // Drop existing function
        await client.query('DROP FUNCTION IF EXISTS execute_sql(TEXT, JSONB);');
        
        // Create version with proper regex escaping
        await client.query(`
            CREATE OR REPLACE FUNCTION execute_sql(query_text TEXT, query_params JSONB DEFAULT '[]'::JSONB)
            RETURNS JSONB AS $$
            DECLARE
                result JSONB;
                final_query TEXT;
                param_value TEXT;
                idx INT;
            BEGIN
                final_query := query_text;
                idx := 0;
                
                -- Replace each ? with quoted parameter value
                WHILE final_query LIKE '%?%' LOOP
                    param_value := query_params ->> idx::TEXT;
                    final_query := regexp_replace(final_query, E'\\?', quote_literal(param_value), 1);
                    idx := idx + 1;
                END LOOP;
                
                -- Execute query and return as JSONB array
                EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || final_query || ') t'
                INTO result;
                
                RETURN COALESCE(result, '[]'::JSONB);
            EXCEPTION WHEN OTHERS THEN
                RAISE EXCEPTION '%', SQLERRM;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
        `);
        
        console.log('✅ execute_sql function recreated');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

createExecuteSqlFunction();
