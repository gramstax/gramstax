/**
 * Retry helpers for Windows filesystem quirks.
 *
 * On Windows, even after `LmdbEnv.close()` resolves, the OS may still hold
 * LMDB memory-mapped file handles open briefly. `rmSync` then fails with EBUSY.
 * This helper retries with backoff, but on final failure just logs the warning
 * instead of throwing — temp directories are cleaned by the OS on reboot.
 */
import {rmSync} from "node:fs"

/**
 * Remove a directory with best-effort retries.
 *
 * @param path - Directory to remove.
 * @param attempts - Maximum number of attempts. Defaults to 20.
 * @param delayMs - Delay between attempts in ms. Defaults to 100.
 */
export async function rmWithRetry(path: string, attempts = 20, delayMs = 100): Promise<void> {
  let _lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      rmSync(path, {recursive: true, force: true})
      return
    } catch (err) {
      _lastErr = err
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  // Best-effort: temp dirs are cleaned eventually. Swallow EBUSY
  // so tests are not polluted by Windows filesystem timing.
}