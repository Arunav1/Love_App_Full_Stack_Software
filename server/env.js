// Loads kaveri-app/.env before anything else reads process.env.
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(import.meta.dirname, '..', '.env');
if (fs.existsSync(file)) process.loadEnvFile(file);
