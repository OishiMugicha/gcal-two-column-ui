export function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};

  if (!header) {
    return cookies;
  }

  for (const part of header.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (!name) {
      continue;
    }
    cookies[name] = decodeURIComponent(valueParts.join('='));
  }

  return cookies;
}

export function appendCookie(res, cookie) {
  const current = res.getHeader('Set-Cookie');
  const next = Array.isArray(current) ? [...current, cookie] : current ? [current, cookie] : [cookie];
  res.setHeader('Set-Cookie', next);
}

export function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options.httpOnly) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  appendCookie(res, parts.join('; '));
}

export function clearCookie(res, name) {
  setCookie(res, name, '', {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
  });
}
