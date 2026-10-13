import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export function createSessionCodec(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const key = createHash('sha256').update(secret).digest();
  return {
    encode(session) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const payload = JSON.stringify({ sid: session.sid, connection: session.connection, expires: session.expires, state: session.state, ready: session.ready });
      const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
    },
    decode(value) {
      try {
        if (typeof value !== 'string' || value.length > 3800) return null;
        const data = Buffer.from(value, 'base64url');
        if (data.length < 29) return null;
        const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
        decipher.setAuthTag(data.subarray(12, 28));
        const payload = Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]);
        const session = JSON.parse(payload.toString('utf8'));
        if (!/^[a-f0-9]{64}$/.test(session.sid) || !session.connection || !Number.isFinite(session.expires) || session.expires <= Date.now()) return null;
        return { ...session, polling: false };
      } catch { return null; }
    },
  };
}
