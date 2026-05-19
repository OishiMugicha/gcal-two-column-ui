import { requireEnv } from './env.js';
import { getSession, SESSION_TTL_SECONDS, encryptValue } from './session.js';
import { setSessionRecord } from './kv.js';

export const GOOGLE_AUTH_SCOPE = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

export async function exchangeCodeForTokens(code, redirectUri) {
  const params = new URLSearchParams({
    code,
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Failed to exchange authorization code');
  }

  return data;
}

async function refreshAccessToken(session) {
  const params = new URLSearchParams({
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
    refresh_token: session.refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Failed to refresh access token');
  }

  if (data.refresh_token) {
    await setSessionRecord(
      session.id,
      {
        refreshToken: encryptValue(data.refresh_token),
        updatedAt: new Date().toISOString(),
      },
      SESSION_TTL_SECONDS,
    );
  }

  return data.access_token;
}

export async function googleFetchForSession(req, url, init = {}) {
  const session = await getSession(req);
  if (!session) {
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }

  const accessToken = await refreshAccessToken(session);
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    const error = new Error(text || `Google API request failed: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  if (response.status === 204 || !text) {
    return undefined;
  }

  return JSON.parse(text);
}
