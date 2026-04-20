/**
 * E2E test setup: load real .env so Prisma connects to the actual test database.
 * Falls back to test defaults for any variables not set.
 */
import * as fs from 'fs';
import * as path from 'path';

// Parse and load .env from the backend package directory
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// Now run the standard env setup (uses ?? so it won't override what we loaded)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('../src/test/setup-env');
