import { db } from '@/lib/db';
import { ensureWebAuthnTables, getCredentialsByAppUserId, saveChallenge } from '@/lib/webauthn-db';
import { getWebAuthnConfig } from '@/lib/webauthn-config';
import { generateAuthenticationOptions } from '@simplewebauthn/server';

export async function POST(req) {
    try {
        const { username } = await req.json().catch(() => ({}));
        let allowCredentials = undefined;

        if (username) {
            await ensureWebAuthnTables();
            const { rows: userRows } = await db.execute({
                sql: 'SELECT id FROM app_users WHERE username = ?',
                args: [username],
            });
            if (userRows.length > 0) {
                const credentials = await getCredentialsByAppUserId(userRows[0].id);
                if (credentials.length > 0) {
                    allowCredentials = credentials.map((cred) => ({
                        id: cred.credential_id,
                        type: 'public-key',
                        transports: JSON.parse(cred.transports || '[]'),
                    }));
                }
            }
        }

        const { rpID } = getWebAuthnConfig(req);
        const challengeKey = username ? `auth:${username}` : 'auth:discoverable';

        const options = await generateAuthenticationOptions({
            rpID,
            allowCredentials,
            userVerification: 'required',
        });

        await ensureWebAuthnTables();
        await saveChallenge(challengeKey, options.challenge);

        return Response.json({ options, discoverable: !username });
    } catch (error) {
        console.error('Error en auth-options:', error);
        return Response.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
