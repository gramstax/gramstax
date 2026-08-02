/**
 * Test helpers — external timeout guards for thread/socket tests.
 *
 * @remarks
 * This package deals with worker threads, real sockets, and pending RPC
 * promises: any of these can block forever on failure. Every test that
 * touches them MUST wrap awaited work in `withTimeout` and pass a bounded
 * timeout to bun:test, so the suite can never hang.
 */

/**
 * Race a promise against an external timeout.
 *
 * @param promise - The awaited operation (thread spawn, RPC, socket I/O).
 * @param ms - Maximum wall-clock time before rejection.
 * @param label - Description used in the timeout error message.
 * @returns The promise result, or rejects with a timeout error.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = `operation`): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

/**
 * Sleep for a given number of milliseconds.
 *
 * @param ms - Milliseconds to wait.
 */
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Poll a condition until it becomes true or the timeout elapses.
 *
 * @param fn - Condition to poll.
 * @param timeoutMs - Maximum wall-clock time before throwing.
 * @param intervalMs - Poll interval.
 */
export async function waitFor(fn: () => boolean, timeoutMs: number, intervalMs = 50) {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`)
    }
    await sleep(intervalMs)
  }
}
