import { ensureWebAuthnTables, countCredentialsByAppUserId } from '@/lib/webauthn-db';

export async function POST(req) {
    try {
        const { appUserId } = await req.json();
        if (!appUserId) return Response.json({ count: 0 });
        const count = await countCredentialsByAppUserId(appUserId);
        return Response.json({ count });
    } catch (error) {
        console.error(error);
        return Response.json({ count: 0 });
    }
}
