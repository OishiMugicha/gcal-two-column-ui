import { sendError, sendJson } from '../_lib/http.js';
import { getSession } from '../_lib/session.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      sendError(res, 405, 'Method Not Allowed');
      return;
    }

    const session = await getSession(req);
    sendJson(res, 200, { authenticated: Boolean(session) });
  } catch {
    sendJson(res, 200, { authenticated: false });
  }
}
