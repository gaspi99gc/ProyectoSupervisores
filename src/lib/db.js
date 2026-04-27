import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Compatibility layer for existing code that uses db.execute()
// This maps common SQL patterns to Supabase queries
export const db = {
    execute: async (query) => {
        const sql = typeof query === 'string' ? query : query.sql;
        const args = typeof query === 'string' ? [] : (query.args || []);
        
        // Parse common SQL patterns and convert to Supabase queries
        const trimmedSql = sql.trim().toLowerCase();
        
        // Handle SELECT * FROM table
        const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)/i);
        if (selectMatch) {
            const table = selectMatch[2];
            let supabaseQuery = supabase.from(table).select('*');
            
            // Handle WHERE clauses with =
            const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|GROUP|$)/i);
            if (whereMatch) {
                const whereClause = whereMatch[1];
                // Simple equality: column = ?
                const eqMatches = whereClause.match(/(\w+)\s*=\s*\?/g);
                if (eqMatches) {
                    eqMatches.forEach((match, idx) => {
                        const col = match.match(/(\w+)\s*=/)[1];
                        supabaseQuery = supabaseQuery.eq(col, args[idx]);
                    });
                }
                
                // Handle LIKE
                const likeMatch = whereClause.match(/(\w+)\s+LIKE\s+\?/i);
                if (likeMatch) {
                    const col = likeMatch[1];
                    const likeIdx = whereClause.split('?').findIndex((part, i) => 
                        i < whereClause.split('?').length - 1 && part.toLowerCase().includes('like')
                    );
                    supabaseQuery = supabaseQuery.ilike(col, args[likeIdx] || '%');
                }
            }
            
            // Handle ORDER BY
            const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
            if (orderMatch) {
                supabaseQuery = supabaseQuery.order(orderMatch[1], { 
                    ascending: !orderMatch[2] || orderMatch[2].toUpperCase() === 'ASC' 
                });
            }
            
            // Handle LIMIT
            const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
            if (limitMatch) {
                supabaseQuery = supabaseQuery.limit(parseInt(limitMatch[1]));
            }
            
            const { data, error } = await supabaseQuery;
            if (error) throw error;
            return { rows: data || [] };
        }
        
        // Handle INSERT
        const insertMatch = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
        if (insertMatch) {
            const table = insertMatch[1];
            const columns = insertMatch[2].split(',').map(c => c.trim());
            
            const insertData = {};
            columns.forEach((col, idx) => {
                insertData[col] = args[idx];
            });
            
            const { data, error } = await supabase.from(table).insert([insertData]).select();
            if (error) throw error;
            return { rows: data || [] };
        }
        
        // Handle UPDATE
        const updateMatch = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i);
        if (updateMatch) {
            const table = updateMatch[1];
            const setClause = updateMatch[2];
            const whereClause = updateMatch[3];
            
            const updateData = {};
            const setPairs = setClause.split(',');
            setPairs.forEach((pair, idx) => {
                const colMatch = pair.match(/(\w+)\s*=\s*\?/);
                if (colMatch) {
                    updateData[colMatch[1]] = args[idx];
                }
            });
            
            const whereColMatch = whereClause.match(/(\w+)\s*=\s*\?/);
            let supabaseQuery = supabase.from(table).update(updateData);
            
            if (whereColMatch) {
                const whereIdx = setPairs.length;
                supabaseQuery = supabaseQuery.eq(whereColMatch[1], args[whereIdx]);
            }
            
            const { data, error } = await supabaseQuery.select();
            if (error) throw error;
            return { rows: data || [] };
        }
        
        // Handle DELETE
        const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)/i);
        if (deleteMatch) {
            const table = deleteMatch[1];
            const whereClause = deleteMatch[2];
            
            const whereColMatch = whereClause.match(/(\w+)\s*=\s*\?/);
            let supabaseQuery = supabase.from(table).delete();
            
            if (whereColMatch) {
                supabaseQuery = supabaseQuery.eq(whereColMatch[1], args[0]);
            }
            
            const { data, error } = await supabaseQuery;
            if (error) throw error;
            return { rows: data || [] };
        }
        
        // Fallback: try to use the execute_sql function if it exists
        try {
            const { data, error } = await supabase.rpc('execute_sql', { 
                query_text: sql,
                query_params: args 
            });
            
            if (error) throw error;
            return { rows: data || [] };
        } catch (fallbackError) {
            console.error('SQL not supported:', sql);
            throw new Error('SQL pattern not supported yet: ' + sql.substring(0, 100));
        }
    }
};
