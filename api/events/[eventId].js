import { googleFetchForSession } from '../_lib/google.js';
import { readJson, sendError, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    const eventId = req.query.eventId;

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      if (!body.calendarId || !body.event) {
        sendError(res, 400, 'calendarId and event are required');
        return;
      }

      const data = await googleFetchForSession(
        req,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(body.calendarId)}/events/${encodeURIComponent(
          eventId,
        )}`,
        {
          method: 'PATCH',
          body: JSON.stringify(body.event),
        },
      );
      sendJson(res, 200, data);
      return;
    }

    if (req.method === 'DELETE') {
      const requestUrl = new URL(req.url, `https://${req.headers.host}`);
      const calendarId = requestUrl.searchParams.get('calendarId');

      if (!calendarId) {
        sendError(res, 400, 'calendarId is required');
        return;
      }

      await googleFetchForSession(
        req,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(
          eventId,
        )}`,
        {
          method: 'DELETE',
        },
      );
      sendJson(res, 200, { ok: true });
      return;
    }

    res.statusCode = 405;
    res.setHeader('Allow', 'PATCH, DELETE');
    res.end('Method Not Allowed');
  } catch (err) {
    sendError(res, err.statusCode || 500, err instanceof Error ? err.message : 'Unknown error');
  }
}
