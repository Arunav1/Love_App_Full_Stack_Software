// Loads kaveri-app/.env before anything else reads process.env.
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(import.meta.dirname, '..', '.env');
if (fs.existsSync(file)) process.loadEnvFile(file);

// Hosts like Render can also provide secrets as files in /etc/secrets.
// A file named like a variable (e.g. ACCESS_CODE) fills that variable if it is empty;
// a secret file named .env is loaded like the one above.
const SECRETS_DIR = process.env.SECRETS_DIR ?? '/etc/secrets';
if (fs.existsSync(SECRETS_DIR)) {
  for (const name of fs.readdirSync(SECRETS_DIR)) {
    const secret = path.join(SECRETS_DIR, name);
    if (name === '.env') process.loadEnvFile(secret);
    else if (/^[A-Z][A-Z0-9_]*$/.test(name) && !process.env[name]) {
      process.env[name] = fs.readFileSync(secret, 'utf8').trim();
    }
  }
}
