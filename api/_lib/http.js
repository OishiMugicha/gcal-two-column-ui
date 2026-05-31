export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

export async function readJson(req) {
  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) {
      const rawBody = req.body.toString('utf8');
      return rawBody ? JSON.parse(rawBody) : {};
    }

    if (typeof req.body === 'string') {
      return req.body ? JSON.parse(req.body) : {};
    }

    return req.body;
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function requireMethod(req, res, method) {
  if (req.method === method) {
    return true;
  }

  res.setHeader('Allow', method);
  sendError(res, 405, 'Method Not Allowed');
  return false;
}
