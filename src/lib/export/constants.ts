/** Above this page count, PDF export uses server Typst CLI instead of browser WASM. */
export const SERVER_EXPORT_PAGE_THRESHOLD = 200;

/** Poll interval when waiting for a server export job (ms). */
export const EXPORT_JOB_POLL_MS = 600;

/** Server-side export jobs older than this are purged (ms). */
export const EXPORT_JOB_TTL_MS = 60 * 60 * 1000;
