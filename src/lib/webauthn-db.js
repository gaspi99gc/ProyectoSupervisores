import { supabase } from './db';

function toBase64(data) {
    if (!data) return null;
    if (typeof data === 'string') return data;
    return Buffer.from(data).toString('base64');
}

function fromBase64(str) {
    if (!str) return null;
    return Buffer.from(str, 'base64');
}

export async function ensureWebAuthnTables() {
    // Tables created via Supabase SQL editor — no-op here
}

export async function saveChallenge(userId, challenge) {
    const { error } = await supabase
        .from('webauthn_challenges')
        .insert({ user_id: String(userId), challenge });
    if (error) throw error;
}

export async function getAndDeleteChallenge(userId) {
    const { data, error } = await supabase
        .from('webauthn_challenges')
        .select('*')
        .eq('user_id', String(userId))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;
    await supabase.from('webauthn_challenges').delete().eq('id', data.id);
    return data.challenge;
}

export async function saveCredential(appUserId, credential) {
    const { error } = await supabase
        .from('webauthn_credentials')
        .insert({
            app_user_id: String(appUserId),
            credential_id: credential.id,
            public_key: toBase64(credential.publicKey),
            counter: credential.counter,
            device_type: credential.deviceType || null,
            backed_up: credential.backedUp || false,
            transports: JSON.stringify(credential.transports || []),
        });
    if (error) throw error;
}

export async function getCredentialById(credentialId) {
    const { data, error } = await supabase
        .from('webauthn_credentials')
        .select('*')
        .eq('credential_id', credentialId)
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;
    return { ...data, public_key: fromBase64(data.public_key) };
}

export async function getCredentialsByAppUserId(appUserId) {
    const { data, error } = await supabase
        .from('webauthn_credentials')
        .select('*')
        .eq('app_user_id', String(appUserId));

    if (error) return [];
    return (data || []).map(row => ({ ...row, public_key: fromBase64(row.public_key) }));
}

export async function deleteCredentialsByAppUserId(appUserId) {
    const { error } = await supabase
        .from('webauthn_credentials')
        .delete()
        .eq('app_user_id', String(appUserId));
    if (error) throw error;
}

export async function countCredentialsByAppUserId(appUserId) {
    const { count, error } = await supabase
        .from('webauthn_credentials')
        .select('*', { count: 'exact', head: true })
        .eq('app_user_id', String(appUserId));
    if (error) return 0;
    return count || 0;
}
