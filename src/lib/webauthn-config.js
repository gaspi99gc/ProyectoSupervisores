export function getWebAuthnConfig(req) {
    const host = req.headers.get('host') || '';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const rpID = isLocal ? 'localhost' : (process.env.WEBAUTHN_RP_ID || 'lasia-limpieza.vercel.app');
    const rpName = process.env.WEBAUTHN_RP_NAME || 'LASIA Limpia';
    const origin = isLocal ? `http://${host}` : `https://${host}`;
    return { rpID, rpName, origin };
}
