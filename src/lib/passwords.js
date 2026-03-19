import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;

export function hashPassword(password) {
    const normalizedPassword = password?.toString() || '';
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(normalizedPassword, salt, KEY_LENGTH).toString('hex');

    return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
    if (!storedHash || !storedHash.includes(':')) {
        return false;
    }

    const [salt, hash] = storedHash.split(':');

    if (!salt || !hash) {
        return false;
    }

    const candidateBuffer = scryptSync(password?.toString() || '', salt, KEY_LENGTH);
    const storedBuffer = Buffer.from(hash, 'hex');

    if (candidateBuffer.length !== storedBuffer.length) {
        return false;
    }

    return timingSafeEqual(candidateBuffer, storedBuffer);
}
