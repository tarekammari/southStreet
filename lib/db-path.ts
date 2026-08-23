import fs from 'fs';
import path from 'path';

/** True on Vercel / AWS Lambda and similar read-only serverless hosts. */
export function isServerlessHost(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY
  );
}

/**
 * SQLite must live on a writable path in production.
 * Vercel's project directory is read-only; only /tmp is writable.
 */
export function resolveDbPath(): string {
  if (process.env.DB_PATH?.trim()) {
    return path.resolve(process.env.DB_PATH.trim());
  }
  if (isServerlessHost()) {
    return path.join('/tmp', 'south_street.db');
  }
  return path.join(process.cwd(), 'south_street.db');
}

/** Copy bundled seed DB into /tmp on first cold start (optional). */
export function ensureDbFile(dbPath: string): void {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(dbPath)) return;

  const seedCandidates = [
    path.join(process.cwd(), 'data', 'south_street.seed.db'),
    path.join(process.cwd(), 'south_street.seed.db'),
  ];

  for (const seed of seedCandidates) {
    if (fs.existsSync(seed)) {
      fs.copyFileSync(seed, dbPath);
      return;
    }
  }
}
