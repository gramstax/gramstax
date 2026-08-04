/**
 * Lightweight in-process metrics store for runtime observability.
 *
 * @remarks
 * Tracks update-level counters, per-listener hits, and latency percentiles in
 * a plain object (no dependencies). Consumed by the `GET /stats` endpoint and
 * by `onUpdateError`/log hooks. Not intended as a permanent telemetry backend —
 * export the snapshot to your favorite metrics system instead.
 *
 * @public
 */
export class MetricsStore {
  /**
   * Total update count per listener name (e.g. text, callbackquerydata).
   *
   * @public
   */
  readonly byListener: Record<string, number> = {}

  /**
   * Lifetime counters for every update outcome.
   *
   * @remarks
   * Includes: `updatesTotal`, `updatesFailed`, `matched`, `noMatch`,
   * `noHandler`, `blocked`, `timeouts`, `skippedDuplicate`, `skippedValidation`.
   *
   * @public
   */
  readonly counts = {
    updatesTotal: 0,
    updatesFailed: 0,
    matched: 0,
    noMatch: 0,
    noHandler: 0,
    blocked: 0,
    timeouts: 0,
    skippedDuplicate: 0,
    skippedValidation: 0
  }

  /** Latency samples (ms) for completed route dispatches. */
  private _latencySum = 0
  private _latencyCount = 0
  private _maxLatencyMs = 0

  /**
   * Epoch milliseconds when this store was created (uptime reference).
   *
   * @public
   */
  readonly startedAt = Date.now()

  /**
   * Record one routed update.
   *
   * @param listenerName - Listener that triggered the update.
   * @param durationMs - Handler wall time in milliseconds.
   * @public
   */
  recordUpdate(listenerName: string, durationMs: number): void {
    this.counts.updatesTotal += 1
    this.byListener[listenerName] = (this.byListener[listenerName] ?? 0) + 1
    this._latencySum += durationMs
    this._latencyCount += 1
    if (durationMs > this._maxLatencyMs) {
      this._maxLatencyMs = durationMs
    }
  }

  /**
   * Create a frozen snapshot of the current counters.
   *
   * @returns A plain JSON-serializable object.
   * @public
   */
  snapshot() {
    return {
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      counts: {...this.counts},
      byListener: {...this.byListener},
      latency: this._latencyCount === 0 ? {count: 0, avgMs: 0, maxMs: 0} : {count: this._latencyCount, avgMs: Math.round(this._latencySum / this._latencyCount), maxMs: this._maxLatencyMs}
    }
  }
}