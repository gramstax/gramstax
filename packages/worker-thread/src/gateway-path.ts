/**
 * Gateway path helpers — normalize socket paths across platforms.
 *
 * @remarks
 * The gateway transport (`net-ipc`) uses Unix domain sockets on POSIX and
 * named pipes on Windows (`\\.\pipe\<name>`). `net-ipc` applies this
 * normalization in its constructor only; this package mutates `options.path`
 * after construction, so the same normalization is applied here explicitly.
 *
 * @public
 */

/**
 * Normalize a gateway socket path for the current platform.
 *
 * @remarks
 * On Windows, POSIX-style paths (`/tmp/server.sock`) and bare identifiers
 * (`gateway-main`) are converted to named pipe paths (`\\.\pipe\...`).
 * Existing `\\.\pipe\` paths and all POSIX paths pass through unchanged.
 *
 * @param path - Raw gateway path (POSIX path or bare identifier).
 * @returns Platform-appropriate socket path.
 *
 * @example
 * ```typescript
 * // On Windows: "\\\\.\\pipe\\gateway-main"
 * normalizeGatewayPath("gateway-main");
 * ```
 * @public
 */
export function normalizeGatewayPath(path: string): string {
  if (process.platform !== `win32`) return path
  if (path.startsWith(`\\\\.\\pipe\\`)) return path
  return `\\\\.\\pipe\\${path.replace(/^\//, ``).replace(/\//g, `-`)}`
}
