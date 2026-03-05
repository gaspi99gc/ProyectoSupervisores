import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
    console.warn("⚠️ Atencion: TURSO_DATABASE_URL o TURSO_AUTH_TOKEN no estan definidos. La base de datos no conectara.");
}

export const db = createClient({
    url: url || 'libsql://dummy.turso.io',
    authToken: authToken || 'dummy-token',
});
