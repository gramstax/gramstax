import type {WorkerThreadLaunch} from "./launch"

/**
 * Manages multiple worker thread instances, providing pooled access and broadcast functionality.
 *
 * @remarks
 * Uses `Map` with `threadId` as key for thread registry.
 * Supports sending requests to all workers via broadcast.
 *
 * @example
 * ```typescript
 * import { WorkerThreadPool, WorkerThreadLaunch } from "gramstax";
 *
 * const workers = await Promise.all(
 *   [1, 2, 3, 4].map(async (i) => {
 *     const w = new WorkerThreadLaunch("./processor.ts", [String(i)]);
 *     await w.ready();
 *     return w;
 *   })
 * );
 *
 * const pool = new WorkerThreadPool(workers);
 * console.log(`Pool has ${pool.threadCount} workers`);
 *
 * // Broadcast to all workers
 * const statuses = await pool.broadcastRequest("getStatus", []);
 * ```
 *
 * @public
 */
export class WorkerThreadPool {
  /**
   * Map of all worker instances by thread ID.
   *
   * @remarks
   * Values are {@link WorkerThreadLaunch} instances keyed by thread ID.
   */
  thread = new Map<number, WorkerThreadLaunch>()

  /**
   * Current number of workers in the pool.
   *
   * @remarks
   * Incremented on add and decremented on kill.
   */
  threadCount = 0

  /**
   * Creates a new WorkerThreadPool instance.
   *
   * @param instance - Initial worker instances to add to the pool.
   */
  constructor(instance: WorkerThreadLaunch[]) {
    this.addMany(instance)
  }

  /**
   * Add a single worker to the pool.
   *
   * @param instance - Worker to add. Registers by threadId.
   *
   * @example
   * ```typescript
   * const newWorker = new WorkerThreadLaunch("./worker.ts", ["3"]);
   * await newWorker.ready();
   * pool.add(newWorker);
   * ```
   * @public
   */
  add(instance: WorkerThreadLaunch) {
    this.thread.set(instance.threadId, instance)
    this.threadCount += 1
  }

  /**
   * Add multiple workers to the pool.
   *
   * @param instance - Workers to add. Registers all workers.
   *
   * @example
   * ```typescript
   * pool.addMany([worker4, worker5]);
   * ```
   * @public
   */
  addMany(instance: WorkerThreadLaunch[]) {
    instance.forEach((it) => this.add(it))
  }

  /**
   * Get a specific worker by thread ID.
   *
   * @param threadId - Worker thread ID. Lookup in pool registry.
   * @returns Worker instance or undefined if not found.
   *
   * @example
   * ```typescript
   * const worker = pool.getInstance(123);
   * if (worker) {
   *   await worker.request("process", [data]);
   * }
   * ```
   * @public
   */
  getInstance(threadId: number) {
    return this.thread.get(threadId)
  }

  /**
   * Kill and remove a specific worker from the pool.
   *
   * @param threadId - Worker thread ID. Terminates worker.
   * @returns The killed worker's threadId, or undefined if not found.
   *
   * @example
   * ```typescript
   * const killedId = pool.kill(123);
   * console.log(`Killed worker ${killedId}`);
   * ```
   * @public
   */
  kill(threadId: number) {
    const ins = this.thread.get(threadId)
    ins?.kill()
    this.thread.delete(threadId)
    this.threadCount -= 1
    return ins?.threadId
  }

  /**
   * Kill and remove all workers from the pool.
   *
   * @example
   * ```typescript
   * pool.killAll();
   * console.log("All workers terminated");
   * ```
   * @public
   */
  killAll() {
    this.thread.values().forEach(({threadId}) => this.kill(threadId))
  }

  /**
   * Send a request to all workers and collect results.
   *
   * @param method - Method name to call. Invoked on every worker.
   * @param params - Method parameters. Sent as positional array.
   * @returns Promise resolving to array of results from all workers.
   *
   * @example
   * ```typescript
   * const results = await pool.broadcastRequest("getStatus", []);
   * console.log("All statuses:", results);
   * ```
   * @public
   */
  async broadcastRequest(method: string, params: any) {
    return await Promise.all(
      Object.values(this.thread).map((ins) => {
        return ins.request(method, params, true)
      })
    )
  }

  /**
   * Send a request to a specific worker.
   *
   * @param threadId - Target worker thread ID. Lookup in pool registry.
   * @param method - Method name to call. Targets worker RPC method.
   * @param params - Method parameters. Sent as positional array.
   * @param _wait - Wait for response. If false, fire-and-forget. Defaults to `true`.
   * @param _others - Additional RPC data. Merged into RPC payload.
   * @returns Promise resolving with worker response.
   *
   * @example
   * ```typescript
   * const result = await pool.request(123, "process", [data]);
   * ```
   * @public
   */
  async request(threadId: number, method: string, params: any, _wait = true, _others?: any) {
    return await this.thread.get(threadId)?.request(method, params, _wait, _others)
  }
}
