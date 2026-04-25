import { db } from './db';

let tablesReady = false;

export async function ensureWebAuthnTables() {
    if (tablesReady) return;

    await db.execute(`
        CREATE TABLE IF NOT EXISTS webauthn_credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            credential_id TEXT UNIQUE NOT NULL,
            public_key BLOB NOT NULL,
            counter INTEGER NOT NULL DEFAULT 0,
            device_type TEXT,
            backed_up INTEGER NOT NULL DEFAULT 0,
            transports TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS webauthn_challenges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            challenge TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    tablesReady = true;
}

export async function saveChallenge(userId, challenge) {
    await ensureWebAuthnTables();
    await db.execute({
        sql: 'INSERT INTO webauthn_challenges (user_id, challenge) VALUES (?, ?)',
        args: [String(userId), challenge],
    });
}

export async function getAndDeleteChallenge(userId) {
    await ensureWebAuthnTables();
    const { rows } = await db.execute({
        sql: 'SELECT * FROM webauthn_challenges WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        args: [String(userId)],
    });
    if (rows.length === 0) return null;
    const challengeRow = rows[0];
    await db.execute({
        sql: 'DELETE FROM webauthn_challenges WHERE id = ?',
        args: [challengeRow.id],
    });
    return challengeRow.challenge;
}

export async function saveCredential(appUserId, credential) {
    await ensureWebAuthnTables();
    await db.execute({
        sql: `INSERT INTO webauthn_credentials
              (app_user_id, credential_id, public_key, counter, device_type, backed_up, transports)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
            appUserId,
            credential.id,
            credential.publicKey,
            credential.counter,
            credential.deviceType || null,
            credential.backedUp ? 1 : 0,
            JSON.stringify(credential.transports || []),
        ],
    });
}

export async function getCredentialById(credentialId) {
    await ensureWebAuthnTables();
    const { rows } = await db.execute({
        sql: 'SELECT * FROM webauthn_credentials WHERE credential_id = ? LIMIT 1',
        args: [credentialId],
    });
    return rows[0] || null;
}

export async function getCredentialsByAppUserId(appUserId) {
    await ensureWebAuthnTables();
    const { rows } = await db.execute({
        sql: 'SELECT * FROM webauthn_credentials WHERE app_user_id = ?',
        args: [appUserId],
    });
    return rows;
}

export async function deleteCredentialsByAppUserId(appUserId) {
    await ensureWebAuthnTables();
    await db.execute({
        sql: 'DELETE FROM webauthn_credentials WHERE app_user_id = ?',
        args: [appUserId],
    });
}

export async function countCredentialsByAppUserId(appUserId) {
    await ensureWebAuthnTables();
    const { rows } = await db.execute({
        sql: 'SELECT COUNT(*) as count FROM webauthn_credentials WHERE app_user_id = ?',
        args: [appUserId],
    });
    return Number(rows[0]?.count || 0);
}
