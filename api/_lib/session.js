import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { parseCookies, setCookie } from './cookies.js';
import { requireEnv } from './env.js';
import { deleteSessionRecord, getSessionRecord, setSessionRecord } from './kv.js';

export const SESSION_COOKIE = 'gcal_session';
export const OAUTH_STATE_COOKIE = 'gcal_oauth_state';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function encryptionKey() {
  return createHash('sha256').update(requireEnv('SESSION_SECRET')).digest();
}

export function encryptValue(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptValue(value) {
  const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function createSessionId() {
  return randomBytes(32).toString('base64url');
}

export function setSessionCookie(res, sessionId) {
  setCookie(res, SESSION_COOKIE, sessionId, {
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
  });
}

export async function createSession(res, refreshToken) {
  const sessionId = createSessionId();
  await setSessionRecord(
    sessionId,
    {
      refreshToken: encryptValue(refreshToken),
      createdAt: new Date().toISOString(),
    },
    SESSION_TTL_SECONDS,
  );
  setSessionCookie(res, sessionId);
  return sessionId;
}

export async function getSession(req) {
  const sessionId = parseCookies(req)[SESSION_COOKIE];
  if (!sessionId) {
    return null;
  }

  const record = await getSessionRecord(sessionId);
  if (!record?.refreshToken) {
    return null;
  }

  return {
    id: sessionId,
    refreshToken: decryptValue(record.refreshToken),
  };
}

export async function destroySession(req) {
  const sessionId = parseCookies(req)[SESSION_COOKIE];
  if (sessionId) {
    await deleteSessionRecord(sessionId);
  }
}
