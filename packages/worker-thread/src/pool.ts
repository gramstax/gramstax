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
 * import { WorkerThreadPool, WorkerThreadLaunch } from "@gramstax/worker-thread";
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
   * Incremented on add and decremented on kill or worker exit.
   */
  threadCount = 0

  /** Round-robin cursor for {@link WorkerThreadPool.execute}. */
  private _cursor = 0

  /**
   * Bound `exit` handlers per threadId so removal can detach them.
   *
   * @remarks
   * Each `add()` stores the exact callback passed to `instance.on()`;
   * `kill()` and exit-removal use it with `instance.off()` to avoid
   * leaking listeners or double-counting late exits.
   */
  private _exitHandlers = new Map<number, () => void>()

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
   * @remarks
   * Re-adding a `threadId` that is already present is idempotent: the
   * entry is replaced but `threadCount` is not incremented and no
   * second `exit` listener is stacked (the old listener is detached
   * first when the instance differs).
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
    const known = this.thread.get(instance.threadId)
    if (known === instance) {
      return
    }
    if (known !== undefined) {
      this._detachExitListener(known)
      const handler = () => this._onWorkerExit(instance)
      this._exitHandlers.set(instance.threadId, handler)
      this.thread.set(instance.threadId, instance)
      ;(instance as unknown as {on?: (event: string, cb: () => void) => unknown}).on?.(`exit`, handler)
      return
    }
    const handler = () => this._onWorkerExit(instance)
    this._exitHandlers.set(instance.threadId, handler)
    this.thread.set(instance.threadId, instance)
    this.threadCount += 1
    ;(instance as unknown as {on?: (event: string, cb: () => void) => unknown}).on?.(`exit`, handler)
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
    instance.forEach((it) => {
      this.add(it)
    })
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
    if (!ins) return undefined
    this._detachExitListener(ins)
    ins.kill()
    this.thread.delete(threadId)
    this.threadCount -= 1
    return ins.threadId
  }

  /**
   * Detach the stored `exit` listener for a worker, if any.
   *
   * @param instance - Worker whose listener should be removed.
   */
  private _detachExitListener(instance: WorkerThreadLaunch) {
    const handler = this._exitHandlers.get(instance.threadId)
    if (handler !== undefined) {
      ;(instance as unknown as {off?: (event: string, cb: () => void) => unknown}).off?.(`exit`, handler)
      this._exitHandlers.delete(instance.threadId)
    }
  }

  /**
   * Remove a worker from the pool when it exits.
   *
   * @param instance - The worker that exited.
   */
  private _onWorkerExit(instance: WorkerThreadLaunch) {
    if (this.thread.get(instance.threadId) === instance) {
      this._detachExitListener(instance)
      this.thread.delete(instance.threadId)
      this.threadCount -= 1
    }
  }

  /**
   * Kill and remove all workers from the pool.
   *
   * @remarks
   * Iterates a snapshot of the registry keys so removals during the
   * loop cannot skip workers; one worker's `kill()` failure never
   * aborts the loop — failures are collected and thrown as a single
   * `AggregateError` after every worker was processed. Resets the
   * round-robin cursor to 0.
   *
   * @example
   * ```typescript
   * pool.killAll();
   * console.log("All workers terminated");
   * ```
   * @public
   */
  killAll() {
    const ids = Array.from(this.thread.keys())
    const failures: Array<unknown> = []
    for (const threadId of ids) {
      try {
        this.kill(threadId)
      } catch (err) {
        failures.push(err)
      }
    }
    this._cursor = 0
    if (failures.length > 0) {
      throw new AggregateError(failures, `WorkerThreadPool.killAll failed for ${failures.length} worker(s)`)
    }
  }

  /**
   * Send a request to all workers and collect results.
   *
   * @remarks
   * FAIL-FAST by design: built on `Promise.all`, so the FIRST worker
   * rejection rejects the whole broadcast and remaining results are
   * discarded. This is intentional — callers that need per-worker
   * outcomes (partial success) must use {@link WorkerThreadPool.broadcastSettled}
   * instead. This method's fail-fast contract is part of the public API
   * and will not change.
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
  async broadcastRequest(method: string, params: unknown[], timeoutMs?: number) {
    return await Promise.all(
      Array.from(this.thread.values()).map((ins) => {
        return ins.request(method, params, true, undefined, timeoutMs)
      })
    )
  }

  /**
   * Send a request to all workers and settle per worker (never fail-fast).
   *
   * @remarks
   * Additive companion to {@link WorkerThreadPool.broadcastRequest}:
   * resolves one envelope per worker in pool insertion order. A worker
   * failure yields `{threadId, ok: false, error}` instead of rejecting
   * the broadcast. Rejects ONLY when the pool is empty — an empty pool
   * is a programming error (no worker outcomes exist to report), while
   * any non-empty pool always resolves, even if every worker fails.
   *
   * @param method - Method name to call. Invoked on every worker.
   * @param params - Method parameters. Sent as positional array.
   * @param timeoutMs - Optional per-request timeout in milliseconds.
   * @returns Per-worker `{threadId, ok, result?, error?}` envelopes.
   *
   * @example
   * ```typescript
   * const settled = await pool.broadcastSettled("getStatus", []);
   * for (const outcome of settled) {
   *   if (outcome.ok) console.log(outcome.threadId, outcome.result);
   *   else console.error(outcome.threadId, outcome.error);
   * }
   * ```
   * @public
   */
  async broadcastSettled(method: string, params: unknown[], timeoutMs?: number): Promise<Array<{threadId: number; ok: boolean; result?: unknown; error?: unknown}>> {
    if (this.thread.size === 0) {
      throw new Error(`WorkerThreadPool is empty — add workers before calling broadcastSettled()`)
    }
    const workers = Array.from(this.thread.values())
    const outcomes: Array<{threadId: number; ok: boolean; result?: unknown; error?: unknown}> = []
    for (const ins of workers) {
      try {
        const result = await ins.request(method, params, true, undefined, timeoutMs)
        outcomes.push({threadId: ins.threadId, ok: true, result})
      } catch (error) {
        outcomes.push({threadId: ins.threadId, ok: false, error})
      }
    }
    return outcomes
  }

  /**
   * Dispatch a request to the next worker using round-robin selection.
   *
   * @remarks
   * The cursor advances on every call and wraps around. Workers that have
   * exited are removed from the pool automatically. Throws when the pool is
   * empty.
   *
   * Post-shrink skew note: the cursor is an index into a snapshot taken
   * per call, so removing workers shifts indices — after a shrink the
   * cursor is rebalanced with modulo against the live size. This keeps
   * every dispatch in bounds; it does not (and cannot) preserve the
   * pre-shrink phase — the dispatch order over the surviving workers
   * still advances strictly round-robin from the rebalanced position.
   *
   * The per-call snapshot (`Array.from`) is retained deliberately: `Map`
   * has no index access, and the snapshot is what makes the cursor
   * arithmetic stable within a call. Dispatch itself is closure-free
   * (direct index + single `request` call) and the visible round-robin
   * sequence is unchanged.
   *
   * @param method - Method name to call. Invoked on the selected worker.
   * @param params - Method parameters. Sent as positional array.
   * @param timeoutMs - Optional per-request timeout in milliseconds.
   * @returns Promise resolving with the selected worker's response.
   *
   * @example
   * ```typescript
   * // distributes process calls across all workers evenly
   * const results = await Promise.all([1, 2, 3].map((n) => pool.execute("process", [n])));
   * ```
   * @public
   */
  execute(method: string, params: unknown[], timeoutMs?: number) {
    const workers = Array.from(this.thread.values())
    if (workers.length === 0) {
      throw new Error(`WorkerThreadPool is empty — add workers before calling execute()`)
    }
    this._cursor = this._cursor % workers.length
    const worker = workers[this._cursor]!
    this._cursor = (this._cursor + 1) % workers.length
    return worker.request(method, params, true, undefined, timeoutMs)
  }

  /**
   * Send a request to a specific worker.
   *
   * @remarks
   * Throws `Error(unknown threadId ...)` when the pool holds no worker
   * with that id. Fail-fast (instead of resolving `undefined`) so a typo
   * or a raced removal surfaces at the call site instead of silently
   * producing `undefined` downstream. No in-repo or example caller
   * depends on the old `undefined` miss — verified via `git grep` over
   * `packages/worker-thread/src`, `packages/worker-thread/example`,
   * `example/` and `real-projects/`.
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
  async request(threadId: number, method: string, params: unknown[], _wait = true, _others?: Record<string, unknown>, timeoutMs?: number) {
    const ins = this.thread.get(threadId)
    if (ins === undefined) {
      throw new Error(`WorkerThreadPool: unknown threadId ${threadId} — worker not in pool`)
    }
    return await ins.request(method, params, _wait, _others, timeoutMs)
  }
}
