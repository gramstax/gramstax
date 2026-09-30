/**
 * Queue statistics accepted by {@link metricsToPrometheus}.
 *
 * @remarks
 * Snapshot of the webhook queue depth at scrape time. All fields are
 * point-in-time counts (unitless). Omitted fields are skipped in the
 * Prometheus exposition instead of being emitted as zero.
 *
 * @public
 */
export type IMetricsQueueStats = {
  /** Current number of queued items. Unit: count. Only emitted when defined. */
  length?: number
  /** Maximum queue capacity. Unit: count. Only emitted when defined. */
  maxSize?: number
  /** Number of producers currently waiting to enqueue. Unit: count. Only emitted when defined. */
  waitingEnqueue?: number
  /** Number of consumers currently waiting to dequeue. Unit: count. Only emitted when defined. */
  waitingDequeue?: number
}
