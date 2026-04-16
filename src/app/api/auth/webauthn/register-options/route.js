import { db } from '@/lib/db';
import { ensureAppUsersTable } from '@/lib/app-users-auth';
import { ensureWebAuthnTables, saveChallenge } from '@/lib/webauthn-db';
import { getWebAuthnConfig } from '@/lib/webauthn-config';
import { generateRegistrationOptions } from '@simplewebauthn/server';

export async function POST(req) {
    try {
        const { appUserId } = await req.json();
        if (!appUserId) {
            return Response.json({ error: 'Usuario no valido' }, { status: 400 });
        }

        await ensureAppUsersTable();
        const { rows } = await db.execute({
            sql: 'SELECT id, username, name, surname, role FROM app_users WHERE id = ?',
            args: [appUserId],
        });

        if (rows.length === 0) {
            return Response.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        const appUser = rows[0];
        const { rpID, rpName } = getWebAuthnConfig(req);

        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userID: String(appUser.id),
            userName: appUser.username,
            userDisplayName: `${appUser.name} ${appUser.surname}`,
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'required',
                userVerification: 'required',
            },
            supportedAlgorithmIDs: [-7, -257],
        });

        await ensureWebAuthnTables();
        await saveChallenge(appUser.id, options.challenge);

        return Response.json({ options });
    } catch (error) {
        console.error('Error en register-options:', error);
        return Response.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
