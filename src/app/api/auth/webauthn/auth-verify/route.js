import { db } from '@/lib/db';
import { ensureAppUsersTable } from '@/lib/app-users-auth';
import { ensureSupervisorStatusRow } from '@/lib/supervisor-status';
import { ensureWebAuthnTables, getAndDeleteChallenge, getCredentialById } from '@/lib/webauthn-db';
import { getWebAuthnConfig } from '@/lib/webauthn-config';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';

export async function POST(req) {
    try {
        const { credential, username } = await req.json();
        if (!credential) {
            return Response.json({ error: 'Credencial requerida' }, { status: 400 });
        }

        const challengeKey = username ? `auth:${username}` : 'auth:discoverable';
        const expectedChallenge = await getAndDeleteChallenge(challengeKey);
        if (!expectedChallenge) {
            return Response.json({ error: 'Challenge expirado o no encontrado' }, { status: 400 });
        }

        const { rpID, origin } = getWebAuthnConfig(req);

        const dbCredential = await getCredentialById(credential.id);
        if (!dbCredential) {
            return Response.json({ error: 'Credencial no registrada' }, { status: 401 });
        }

        const verification = await verifyAuthenticationResponse({
            response: credential,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            credential: {
                id: dbCredential.credential_id,
                publicKey: new Uint8Array(dbCredential.public_key),
                counter: Number(dbCredential.counter),
                transports: JSON.parse(dbCredential.transports || '[]'),
            },
            requireUserVerification: true,
        });

        if (!verification.verified) {
            return Response.json({ error: 'Autenticacion fallida' }, { status: 401 });
        }

        await db.execute({
            sql: 'UPDATE webauthn_credentials SET counter = ? WHERE id = ?',
            args: [verification.authenticationInfo.newCounter, dbCredential.id],
        });

        await ensureAppUsersTable();
        const { rows } = await db.execute({
            sql: 'SELECT id, username, name, surname, role, login_enabled, supervisor_id FROM app_users WHERE id = ?',
            args: [dbCredential.app_user_id],
        });

        if (rows.length === 0) {
            return Response.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        const appUser = rows[0];
        if (!appUser.login_enabled) {
            return Response.json({ error: 'Tu acceso esta deshabilitado. Contacta al administrador.' }, { status: 403 });
        }

        const user = {
            id: appUser.role === 'supervisor' ? appUser.supervisor_id : appUser.id,
            app_user_id: appUser.id,
            name: appUser.name,
            surname: appUser.surname,
            dni: appUser.username,
            role: appUser.role,
        };

        if (appUser.role === 'supervisor' && appUser.supervisor_id) {
            await ensureSupervisorStatusRow(appUser.supervisor_id);
        }

        return Response.json({ user });
    } catch (error) {
        console.error('Error en auth-verify:', error);
        return Response.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
