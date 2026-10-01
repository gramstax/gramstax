import {tmpdir} from "node:os"
import {isAbsolute, join} from "node:path"

/**
 * Maximum socket path length enforced on POSIX.
 *
 * @remarks
 * Unix domain socket paths are limited by `sun_path` (108 bytes including
 * the NUL terminator on Linux); exceeding it surfaces as a cryptic `ENOENT`
 * at bind/connect time. Rejecting anything over 104 chars early keeps the
 * failure local and readable.
 */
const MAX_POSIX_SOCKET_PATH = 104

/**
 * Normalize a gateway socket path for the current platform.
 *
 * @remarks
 * On Windows, POSIX-style paths (`/tmp/server.sock`) and bare identifiers
 * (`gateway-main`) are converted to named pipes (`\\.\pipe\...`). Dashes
 * are escaped (`-` → `--`) before `/` is mapped to `-`, so `/tmp/a-b` and
 * `/tmp/a/b` land on distinct pipes instead of colliding.
 * Existing `\\.\pipe\` paths pass through unchanged.
 *
 * On POSIX, absolute paths pass through unchanged (after a length check);
 * relative or bare identifiers are resolved against `os.tmpdir()` so socket
 * files never pollute the process working directory.
 *
 * @param path - Raw gateway path (POSIX path or bare identifier).
 * @returns Platform-appropriate socket path.
 * @throws When the resolved POSIX path exceeds 104 characters.
 *
 * @example
 * ```typescript
 * // On Windows: "\\\\.\\pipe\\gateway--main"
 * normalizeGatewayPath("gateway-main");
 * ```
 * @public
 */
export function normalizeGatewayPath(path: string): string {
  if (process.platform === `win32`) {
    if (path.startsWith(`\\\\.\\pipe\\`)) return path
    return `\\\\.\\pipe\\${path.replace(/^\//, ``).replace(/-/g, `--`).replace(/\//g, `-`)}`
  }
  const resolved = isAbsolute(path) ? path : join(tmpdir(), path)
  if (resolved.length > MAX_POSIX_SOCKET_PATH) {
    throw new Error(`gateway socket path exceeds ${MAX_POSIX_SOCKET_PATH} characters (${resolved.length}): ${resolved}`)
  }
  return resolved
}
