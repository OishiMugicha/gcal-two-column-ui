import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const requiredNames = [
  'VITE_FULLCALENDAR_LICENSE_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'SESSION_SECRET',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
];

const envFiles = ['.env', '.env.local'];
const values = { ...process.env };

for (const fileName of envFiles) {
  const filePath = resolve(fileName);
  if (!existsSync(filePath)) {
    continue;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const name = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^(['"])(.*)\1$/, '$2');
    values[name] = value;
  }
}

const missingNames = requiredNames.filter((name) => !values[name]);

if (missingNames.length > 0) {
  console.error('ローカル動作確認に必要な環境変数が不足しています:');
  for (const name of missingNames) {
    console.error(`- ${name}`);
  }
  process.exit(1);
}

console.log('ローカル動作確認に必要な環境変数は設定されています。');
