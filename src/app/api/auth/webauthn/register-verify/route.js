import { db } from '@/lib/db';
import { ensureAppUsersTable } from '@/lib/app-users-auth';
import { ensureWebAuthnTables, getAndDeleteChallenge, saveCredential, deleteCredentialsByAppUserId } from '@/lib/webauthn-db';
import { getWebAuthnConfig } from '@/lib/webauthn-config';
import { verifyRegistrationResponse } from '@simplewebauthn/server';

export async function POST(req) {
    try {
        const { appUserId, credential } = await req.json();
        if (!appUserId || !credential) {
            return Response.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        await ensureAppUsersTable();
        const { rows } = await db.execute({
            sql: 'SELECT id FROM app_users WHERE id = ?',
            args: [appUserId],
        });
        if (rows.length === 0) {
            return Response.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        const expectedChallenge = await getAndDeleteChallenge(appUserId);
        if (!expectedChallenge) {
            return Response.json({ error: 'Challenge expirado o no encontrado' }, { status: 400 });
        }

        const { rpID, origin } = getWebAuthnConfig(req);

        const verification = await verifyRegistrationResponse({
            response: credential,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            requireUserVerification: true,
        });

        if (!verification.verified || !verification.registrationInfo) {
            return Response.json({ error: 'Verificacion fallida' }, { status: 400 });
        }

        const { registrationInfo } = verification;
        const newCredential = {
            id: registrationInfo.credential.id,
            publicKey: registrationInfo.credential.publicKey,
            counter: registrationInfo.credential.counter,
            deviceType: registrationInfo.credentialDeviceType,
            backedUp: registrationInfo.credentialBackedUp,
            transports: credential.response?.transports || [],
        };

        await ensureWebAuthnTables();
        await deleteCredentialsByAppUserId(appUserId);
        await saveCredential(appUserId, newCredential);

        return Response.json({ verified: true });
    } catch (error) {
        console.error('Error en register-verify:', error);
        return Response.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
