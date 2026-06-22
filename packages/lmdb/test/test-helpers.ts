/**
 * Retry helpers for Windows filesystem quirks.
 *
 * On Windows, even after `LmdbEnv.close()` resolves, the OS may still hold
 * file handles open briefly. `rmSync` then fails with EBUSY. This helper
 * retries with backoff so the test cleanup is robust on all platforms.
 */
import {rmSync} from "node:fs"

/**
 * Remove a directory with retries to handle Windows EBUSY races.
 *
 * @param path - Directory to remove.
 * @param attempts - Maximum number of attempts. Defaults to 10.
 * @param delayMs - Delay between attempts in ms. Defaults to 50.
 */
export async function rmWithRetry(path: string, attempts = 10, delayMs = 50): Promise<void> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      rmSync(path, {recursive: true, force: true})
      return
    } catch (err) {
      lastErr = err
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw lastErr
}