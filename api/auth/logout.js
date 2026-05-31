import { clearCookie } from '../_lib/cookies.js';
import { requireMethod, sendError, sendJson } from '../_lib/http.js';
import { SESSION_COOKIE, destroySession } from '../_lib/session.js';

export default async function handler(req, res) {
  try {
    if (!requireMethod(req, res, 'POST')) {
      return;
    }

    await destroySession(req);
    clearCookie(res, SESSION_COOKIE);
    sendJson(res, 200, { ok: true });
  } catch (err) {
    clearCookie(res, SESSION_COOKIE);
    sendError(res, 500, err instanceof Error ? err.message : 'Logout failed');
  }
}
