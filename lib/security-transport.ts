/**
 * Shared secret between the Edge middleware and the Node ingest route.
 * Both runtimes read it at build time, so a plain module constant is enough.
 * Override with SECURITY_INGEST_TOKEN in .env for a hardened deployment.
 */
export const INGEST_HEADER = 'x-ss-monitor';

export const INGEST_TOKEN = process.env.SECURITY_INGEST_TOKEN || 'ss-internal-monitor-2026';
