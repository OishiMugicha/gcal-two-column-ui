import { clearCookie, parseCookies } from '../../_lib/cookies.js';
import { getBaseUrl } from '../../_lib/env.js';
import { exchangeCodeForTokens } from '../../_lib/google.js';
import { createSession, OAUTH_STATE_COOKIE } from '../../_lib/session.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET');
      res.end('Method Not Allowed');
      return;
    }

    const requestUrl = new URL(req.url, getBaseUrl(req));
    const code = requestUrl.searchParams.get('code');
    const state = requestUrl.searchParams.get('state');
    const error = requestUrl.searchParams.get('error');
    const expectedState = parseCookies(req)[OAUTH_STATE_COOKIE];

    if (error) {
      throw new Error(error);
    }
    if (!code || !state || !expectedState || state !== expectedState) {
      throw new Error('Invalid OAuth callback state');
    }

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${getBaseUrl(req)}/api/auth/google/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      throw new Error('Google did not return a refresh token. Re-consent is required.');
    }

    await createSession(res, tokens.refresh_token);
    clearCookie(res, OAUTH_STATE_COOKIE);

    res.statusCode = 302;
    res.setHeader('Location', '/');
    res.end();
  } catch (err) {
    clearCookie(res, OAUTH_STATE_COOKIE);
    res.statusCode = 302;
    res.setHeader('Location', `/?auth_error=${encodeURIComponent(err instanceof Error ? err.message : 'Login failed')}`);
    res.end();
  }
}
