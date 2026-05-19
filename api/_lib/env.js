export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || 'https';
  const host = req.headers.host;

  return `${proto}://${host}`;
}
