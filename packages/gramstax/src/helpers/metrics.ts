import type {IMetricsQueueStats} from "~/types/metrics"

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
   * `noHandler`, `blocked`, `timeouts`, `skippedDuplicate`, `skippedValidation`,
   * `dropped`.
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
    skippedValidation: 0,
    dropped: 0
  }

  /** Latency samples (ms) for completed route dispatches. */
  private _latencySum = 0
  /** Completed dispatch count; divisor for the average latency in `snapshot`. */
  private _latencyCount = 0
  /** Highest observed dispatch latency in milliseconds; exposed as `maxMs` by `snapshot`. */
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

/**
 * Serializes a {@link MetricsStore} snapshot into Prometheus text format.
 *
 * @remarks
 * Emits `# HELP`/`# TYPE` headers, per-listener counters, per-counter
 * cumulative totals, latency avg/max gauges, uptime, and optional queue
 * stats. Zero-valued counters are skipped. Ends with a trailing newline.
 *
 * @param snapshot - A `MetricsStore` snapshot (see `MetricsStore.snapshot`).
 * @param queueStats - Optional webhook queue statistics.
 * @returns Prometheus exposition text.
 *
 * @public
 */
export function metricsToPrometheus(snapshot: ReturnType<MetricsStore[`snapshot`]>, queueStats?: IMetricsQueueStats | null): string {
  const lines: string[] = []
  lines.push(`# HELP gramstax_updates_total Total updates processed`)
  lines.push(`# TYPE gramstax_updates_total counter`)
  for (const [listener, count] of Object.entries(snapshot.byListener)) {
    lines.push(`gramstax_updates_total{listener="${listener}"} ${count}`)
  }
  for (const [key, value] of Object.entries(snapshot.counts)) {
    if (value > 0) {
      lines.push(`gramstax_updates_${key}_total ${value}`)
    }
  }
  if (snapshot.latency.count > 0) {
    lines.push(`# HELP gramstax_update_duration_ms Update handler duration in milliseconds`)
    lines.push(`# TYPE gramstax_update_duration_ms gauge`)
    lines.push(`gramstax_update_duration_ms{quantile="avg"} ${snapshot.latency.avgMs}`)
    lines.push(`gramstax_update_duration_ms{quantile="max"} ${snapshot.latency.maxMs}`)
  }
  lines.push(`gramstax_uptime_seconds ${snapshot.uptimeSeconds}`)
  if (queueStats) {
    if (queueStats.length !== undefined) lines.push(`gramstax_queue_length ${queueStats.length}`)
    if (queueStats.maxSize !== undefined) lines.push(`gramstax_queue_max_size ${queueStats.maxSize}`)
    if (queueStats.waitingEnqueue !== undefined) lines.push(`gramstax_queue_waiting_enqueue ${queueStats.waitingEnqueue}`)
    if (queueStats.waitingDequeue !== undefined) lines.push(`gramstax_queue_waiting_dequeue ${queueStats.waitingDequeue}`)
  }
  return `${lines.join(`\n`)}\n`
}
