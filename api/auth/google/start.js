import { randomBytes } from 'node:crypto';
import { setCookie } from '../../_lib/cookies.js';
import { getBaseUrl, requireEnv } from '../../_lib/env.js';
import { GOOGLE_AUTH_SCOPE } from '../../_lib/google.js';
import { OAUTH_STATE_COOKIE } from '../../_lib/session.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.end('Method Not Allowed');
    return;
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${getBaseUrl(req)}/api/auth/google/callback`;
  const state = randomBytes(24).toString('base64url');
  const params = new URLSearchParams({
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_AUTH_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });

  setCookie(res, OAUTH_STATE_COOKIE, state, {
    maxAge: 60 * 10,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
  });

  res.statusCode = 302;
  res.setHeader('Location', `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.end();
}
