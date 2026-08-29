

import {mkdirSync, readdirSync, rmSync, statSync} from "node:fs"
import {join} from "node:path"
import {LmdbEnv} from "./env"

/**
 * Read-only replica helper + rotating backup utility.
 *
 * @remarks
 * {@link LmdbReplica.open} attaches a read-only {@link LmdbEnv} to an existing
 * LMDB data file, with optional periodic `resetReadTxn` polling.
 * {@link backupWithRetention} creates timestamped backups and prunes to `keep`.
 *
 * @public
 */
export class LmdbReplica {
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
      if (typeof (timer as unknown as {unref?: () => void}).unref === `function`) {
        ;(timer as unknown as {unref: () => void}).unref()
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

/**
 * Create a timestamped backup inside `baseDir` and prune to `keep` most recent.
 *
 * @param env - Writer env to back up (must be open).
 * @param baseDir - Directory that will contain timestamped backup subdirs.
 * @param keep - Number of most recent backups to retain (default `3`).
 * @returns The path of the newly created backup.
 *
 * @public
 */
export async function backupWithRetention(env: LmdbEnv, baseDir: string, keep = 3): Promise<string> {
  // Ensure base dir exists
  try {
    mkdirSync(baseDir, {recursive: true})
  } catch {}
  const stamp = `${Date.now().toString().padStart(13, `0`)}-${Math.random().toString(36).slice(2, 6)}`
  const dest = join(baseDir, `backup-${stamp}`)
  mkdirSync(dest, {recursive: true})
  await env.backup(dest)
  // Prune oldest beyond `keep`
  try {
    const entries = readdirSync(baseDir)
      .map((name) => {
        const full = join(baseDir, name)
        let mtime = 0
        try {
          mtime = statSync(full).mtimeMs
        } catch {
          mtime = 0
        }
        return {name, full, mtime}
      })
      .sort((a, b) => a.mtime - b.mtime)
    const toDelete = entries.length - keep
    for (let i = 0; i < toDelete; i++) {
      const victim = entries[i]
      if (!victim) continue
      try {
        rmSync(victim.full, {recursive: true, force: true})
      } catch {}
    }
  } catch {}
  return dest
}
