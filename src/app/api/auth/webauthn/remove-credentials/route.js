import { ensureWebAuthnTables, deleteCredentialsByAppUserId } from '@/lib/webauthn-db';

export async function POST(req) {
    try {
        const { appUserId } = await req.json();
        if (!appUserId) return Response.json({ error: 'Usuario no valido' }, { status: 400 });
        await deleteCredentialsByAppUserId(appUserId);
        return Response.json({ success: true });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error interno' }, { status: 500 });
    }
}
