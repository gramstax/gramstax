import {LmdbEnv} from "./env"

/**
 * Read-only reader helper.
 *
 * @remarks
 * {@link LmdbReader.open} attaches a read-only {@link LmdbEnv} to an existing
 * LMDB data file, with optional periodic `resetReadTxn` polling. Backup
 * lifecycle lives in {@link LmdbBackup} (`./backup`).
 *
 * @public
 */
export class LmdbReader {
  /**
   * Open a read-only replica of an existing env at `path`.
   *
   * @param path - Same path as the writer env.
   * @param opts - Optional `maxDbs` and `pollMs` for periodic `resetReadTxn`.
   * @returns A read-only {@link LmdbEnv} — caller must `close()` it.
   */
  static async open(path: string, opts?: {maxDbs?: number; pollMs?: number}): Promise<LmdbEnv> {
    const env = new LmdbEnv({path, readOnly: true, maxDbs: opts?.maxDbs ?? 10})
    if (opts?.pollMs && opts.pollMs > 0) {
      const timer = setInterval(() => {
        try {
          env.resetReadTxn()
        } catch {}
      }, opts.pollMs)
      // Allow process to exit without waiting for this timer
      if (typeof timer.unref === `function`) {
        timer.unref()
      }
      // Stash timer so close() can clear it — monkey-patch close
      const origClose = env.close.bind(env)
      let cleared = false
      env.close = async () => {
        if (!cleared) {
          cleared = true
          clearInterval(timer)
        }
        return origClose()
      }
    }
    return env
  }
}
