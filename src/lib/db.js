import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables.');
}

// Admin client (service role) — for DB operations and admin auth actions
export const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
});

// Auth client (anon key) — for user-facing signInWithPassword
export const supabaseAuth = createClient(supabaseUrl, anonKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
});

// Compatibility layer for simple SQL patterns
export const db = {
    execute: async (query) => {
        const sql = typeof query === 'string' ? query : query.sql;
        const args = typeof query === 'string' ? [] : (query.args || []);

        const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)/i);
        if (selectMatch) {
            const table = selectMatch[2];
            let q = supabase.from(table).select('*');

            const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|GROUP|$)/i);
            if (whereMatch) {
                const whereClause = whereMatch[1];
                const eqMatches = whereClause.match(/(\w+)\s*=\s*\?/g);
                if (eqMatches) {
                    eqMatches.forEach((match, idx) => {
                        const col = match.match(/(\w+)\s*=/)[1];
                        q = q.eq(col, args[idx]);
                    });
                }
            }

            const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
            if (orderMatch) {
                q = q.order(orderMatch[1], { ascending: !orderMatch[2] || orderMatch[2].toUpperCase() === 'ASC' });
            }

            const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
            if (limitMatch) q = q.limit(parseInt(limitMatch[1]));

            const { data, error } = await q;
            if (error) throw error;
            return { rows: data || [] };
        }

        const insertMatch = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
        if (insertMatch) {
            const table = insertMatch[1];
            const columns = insertMatch[2].split(',').map(c => c.trim());
            const insertData = {};
            columns.forEach((col, idx) => { insertData[col] = args[idx]; });
            const { data, error } = await supabase.from(table).insert([insertData]).select();
            if (error) throw error;
            return { rows: data || [] };
        }

        const updateMatch = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i);
        if (updateMatch) {
            const table = updateMatch[1];
            const setClause = updateMatch[2];
            const whereClause = updateMatch[3];
            const updateData = {};
            const setPairs = setClause.split(',');
            setPairs.forEach((pair, idx) => {
                const colMatch = pair.match(/(\w+)\s*=\s*\?/);
                if (colMatch) updateData[colMatch[1]] = args[idx];
            });
            const whereColMatch = whereClause.match(/(\w+)\s*=\s*\?/);
            let q = supabase.from(table).update(updateData);
            if (whereColMatch) q = q.eq(whereColMatch[1], args[setPairs.length]);
            const { data, error } = await q.select();
            if (error) throw error;
            return { rows: data || [] };
        }

        const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)/i);
        if (deleteMatch) {
            const table = deleteMatch[1];
            const whereClause = deleteMatch[2];
            const whereColMatch = whereClause.match(/(\w+)\s*=\s*\?/);
            let q = supabase.from(table).delete();
            if (whereColMatch) q = q.eq(whereColMatch[1], args[0]);
            const { data, error } = await q;
            if (error) throw error;
            return { rows: data || [] };
        }

        throw new Error('SQL pattern not supported: ' + sql.substring(0, 100));
    }
};
