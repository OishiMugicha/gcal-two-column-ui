import { requireEnv } from './env.js';

const SESSION_PREFIX = 'gcal-two-column-ui:session:';

async function kvCommand(command, args = []) {
  const url = requireEnv('KV_REST_API_URL').replace(/\/$/, '');
  const token = requireEnv('KV_REST_API_TOKEN');
  const path = [command, ...args.map((arg) => encodeURIComponent(String(arg)))].join('/');
  const response = await fetch(`${url}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`KV request failed: ${response.status}`);
  }

  return response.json();
}

export async function getSessionRecord(sessionId) {
  const data = await kvCommand('get', [`${SESSION_PREFIX}${sessionId}`]);
  return data.result ? JSON.parse(data.result) : null;
}

export async function setSessionRecord(sessionId, record, ttlSeconds) {
  await kvCommand('set', [`${SESSION_PREFIX}${sessionId}`, JSON.stringify(record), 'EX', ttlSeconds]);
}

export async function deleteSessionRecord(sessionId) {
  await kvCommand('del', [`${SESSION_PREFIX}${sessionId}`]);
}
