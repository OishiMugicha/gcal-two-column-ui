import { clearCookie } from '../_lib/cookies.js';
import { requireMethod, sendJson } from '../_lib/http.js';
import { SESSION_COOKIE, destroySession } from '../_lib/session.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) {
    return;
  }

  await destroySession(req);
  clearCookie(res, SESSION_COOKIE);
  sendJson(res, 200, { ok: true });
}
