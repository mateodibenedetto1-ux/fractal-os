import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { SUPABASE_SERVICE } from './env';

/** Clave de cifrado: AI_KEYS_SECRET si existe; si no, derivada del service role (nunca sale del servidor). */
function key() {
  const base = process.env.AI_KEYS_SECRET || SUPABASE_SERVICE;
  if (!base) throw new Error('Falta un secreto para cifrar las API keys');
  return createHash('sha256').update(`fractal-ai-keys:${base}`).digest();
}

export function encrypt(text: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function decrypt(blob: string) {
  const [iv, tag, enc] = blob.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}
