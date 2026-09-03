/**
 * Android AsyncStorage is SQLite-backed with a fixed DB size cap, so a write can
 * fail while the phone still has plenty of free space. Every store that keeps a
 * growing history must recognise that error and shed old data rather than lose
 * the write — see `saveCgmStore` / `saveMetricsStore`.
 */

/** True when a failed write was the storage DB hitting its size cap. */
export function isSqliteFullError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /SQLITE_FULL|database or disk is full/i.test(msg);
}
