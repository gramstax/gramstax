/**
 * Worker thread launcher — manages lifecycle from the main thread.
 *
 * @remarks
 * Spawns a {@link Worker} thread, sets up the RPC channel, and provides
 * `request()` / `sendRequest()` for calling worker methods and waiting
 * for responses. Also exposes `kill()` / `send()` for lifecycle control.
 *
 * @public
 */

import {EventEmitter} from "node:events"
import {isMainThread, Worker} from "node:worker_threads"
import {reportError} from "./error-handler"
import {WorkerThreadRpc} from "./rpc"

/**
 * Manages worker thread lifecycle from the main thread.
 * Handles spawning, communication, and termination of worker threads.
 *
 * @remarks
 * Automatically registers SIGINT/SIGTERM handlers to terminate workers.
 * Uses promise-based ready detection for synchronization. Extends
 * `EventEmitter` — emits `ready`, `exit` and `error` lifecycle events.
 *
 * @example
 * ```typescript
 * import { WorkerThreadLaunch } from "gramstax";
 *
 * async function main() {
 *   const worker = new WorkerThreadLaunch("./jobs/processor.ts", ["config.json"]);
 *   await worker.ready();
 *   console.log(`Worker ${worker.threadId} is ready`);
 *
 *   const result = await worker.request("process", [{ data: "test" }]);
 *   console.log("Result:", result);
 *
 *   worker.kill();
 * }
 * ```
 *
 * @example Initialization method for handling requests from worker threads. Both can communicate with each other using an example like this, but this is very very rarely used.
 * ```typescript
 * import { WorkerThreadLaunch } from "gramstax";
 *
 * // main.ts
 * export class MainThread extends WorkerThreadLaunch {
 *   mtdHi() {
 *     // called from thread worker
 *     return `Hi, this is main thread`
 *   }
 * }
 *
 * async function main() {
 *   const worker = new MainThread("./jobs/processor.ts", ["config.json"]);
 *   await worker.ready();
 *   console.log(`Worker ${worker.threadId} is ready`);
 * }
 *
 * // jobs/processor.ts
 * import {MainThread} from "./main"
 * import {WorkerThreadInit} from "gramstax";
 *
 * class Worker extends WorkerThreadInit {
 *   constructor() {
 *     super();
 *     log.info(`Worker ${this.id} started`);
 *     this.request(`mtdHi`, []).then((res) => {
 *       res; // `Hi, this is main thread`
 *     })
 *   }
 * }
 * export const MyWorker = WorkerThreadExport.init({
 *   path: __filename,
 *   WTInit: MainThread,
 * });
 * ```
 *
 * @public
 */
export class WorkerThreadLaunch extends EventEmitter {
  /**
   * Check if currently running in the main thread.
   * Re-exported from `node:worker_threads`.
   *
   * @remarks
   * Uses `node:worker_threads:isMainThread` to guard main-thread only logic.
   */
  static isMainThread = isMainThread

  private _readyResolved = false
  private _readyResolve?: () => void
  private _readyReject?: (err: Error) => void
  private _readyPromise = new Promise<void>((resolve, reject) => {
    this._readyResolve = resolve
    this._readyReject = reject
  })

  /** Whether the worker thread has exited. Guards `kill()` against double-termination hangs. */
  private exited = false

  /**
   * The main process ID.
   *
   * @remarks
   * Mirrors `process.pid` in the main thread.
   */
  pid = process.pid

  /**
   * The underlying Node.js Worker instance from `node:worker_threads`.
   *
   * @remarks
   * Instance of `node:worker_threads:Worker` used to communicate with the worker thread.
   */
  thread: Worker = {} as unknown as Worker

  /**
   * The worker thread ID.
   *
   * @remarks
   * Matches `new node:worker_threads:worker().threadId`.
   */
  threadId: number = {} as unknown as number

  /**
   * RPC handler for method invocations.
   *
   * @remarks
   * Uses {@link WorkerThreadRpc} for request/response messaging.
   */
  rpc: WorkerThreadRpc = {} as unknown as WorkerThreadRpc

  /**
   * Creates a new WorkerThreadLaunch instance and spawns the worker thread.
   *
   * @param path - Path to the worker file. Must be valid JavaScript/TypeScript file.
   * @param argv - Arguments to pass to worker. Accessible via `process.argv` in worker.
   * @param register - Object with value function to expose. Called by thread worker. Defaults to `this`.
   *
   * @public
   */
  constructor(
    public path: string,
    public argv: unknown[],
    public register?: Record<string, (...args: never[]) => unknown>
  ) {
    super()
    this.init()
    this.rpc = new WorkerThreadRpc(this.send.bind(this), register ?? (this as unknown as Record<string, (...args: never[]) => unknown>))
  }

  /**
   * Wait for the worker to signal it's ready.
   *
   * @returns Promise that resolves when worker calls `super()` in `WorkerThreadInit`,
   *   or rejects when the worker exits before signaling ready.
   *
   * @example
   * ```typescript
   * const worker = new WorkerThreadLaunch("./worker.ts", []);
   * await worker.ready();
   * console.log("Worker is ready");
   * ```
   * @public
   */
  ready() {
    return this._readyPromise
  }

  /**
   * [LOW-LEVEL] Internal method called by worker to signal readiness.
   *
   * @remarks
   * Resolves the `ready()` promise and emits the `ready` event (once).
   * @public
   */
  readyResolve() {
    if (!this._readyResolved) {
      this._readyResolved = true
      this._readyResolve?.()
      this.emit(`ready`)
    }
  }

  /**
   * [LOW-LEVEL] Initialize the worker thread and set up message handlers.
   *
   * @remarks
   * Spawns the worker, wires message/error/exit handlers, and registers
   * SIGINT/SIGTERM cleanup. On exit, all pending RPC requests are rejected
   * and the `exit` event is emitted.
   * @public
   */
  init() {
    if (!this.path || typeof this.path !== `string`) {
      throw new Error(`WorkerThreadLaunch requires a non-empty worker path`)
    }
    this.thread = new Worker(this.path, {argv: this.argv.length === 0 && this.argv[0] === undefined ? undefined : this.argv})
    this.threadId = this.thread.threadId
    this.thread.on(`message`, (data) => this.handleOnMessage(data))
    this.thread.on(`error`, (err) => this.safeEmitError(err))
    this.thread.on(`exit`, (code) => {
      this.rpc.rejectAllPending(new Error(`Worker ${this.threadId} exited unexpectedly (code ${code})`))
      if (!this._readyResolved) {
        this._readyReject?.(new Error(`Worker ${this.threadId} exited before signaling ready (code ${code})`))
      }
      this.exited = true
      this.emit(`exit`, code)
      this.kill()
    })
    process.once(`SIGINT`, () => this.kill())
    process.once(`SIGTERM`, () => this.kill())
  }

  /**
   * [LOW-LEVEL] Handle incoming messages from the worker thread.
   *
   * @param data - Message data from worker.
   * @public
   */
  async handleOnMessage(data: Parameters<WorkerThreadRpc[`make`]>[0]) {
    this.rpc.make(data).catch((err: unknown) => {
      this.safeEmitError(err)
    })
  }

  /**
   * Emit an `error` event without risking an uncaught throw.
   *
   * @remarks
   * Node's `EventEmitter` throws when `error` is emitted with no listeners,
   * which would crash the process for a recoverable worker error. With
   * listeners, the error is emitted; without, it is routed to the
   * package-wide handler set via `setDefaultErrorHandler` (silent by
   * default — library code never writes to the console).
   *
   * @param err - The error to emit (or report).
   */
  private safeEmitError(err: unknown) {
    if (this.listenerCount(`error`) > 0) {
      this.emit(`error`, err)
    } else {
      reportError(err)
    }
  }

  /**
   * Terminate the worker thread immediately.
   *
   * @remarks
   * Safe to call multiple times and after the worker has already exited —
   * terminating an exited thread hangs on some runtimes, so exited workers
   * resolve immediately instead.
   *
   * @returns Promise resolving when the thread has terminated.
   *
   * @example
   * ```typescript
   * worker.kill();
   * ```
   * @public
   */
  kill() {
    if (this.exited) return Promise.resolve()
    // terminate() can reject when the thread is already mid-exit — kill is
    // best-effort, so never let that surface to the caller
    return this.thread.terminate().catch(() => {})
  }

  /**
   * Shut the worker down gracefully.
   *
   * @remarks
   * Sends an RPC `shutdown` request to the worker — the worker runs its
   * `onBeforeExit` hook (flush state, close connections) before replying.
   * The worker is then terminated. If the worker does not confirm within
   * `timeoutMs`, it is force-terminated.
   *
   * @param timeoutMs - How long to wait for the worker's shutdown confirmation. Defaults to `5000`.
   * @returns Promise resolving when the worker has terminated.
   *
   * @example
   * ```typescript
   * await worker.shutdown(10_000);
   * ```
   * @public
   */
  async shutdown(timeoutMs = 5000) {
    try {
      await this.request(`shutdown`, [], true, undefined, timeoutMs)
    } catch {
      // worker may be unresponsive or already gone — force terminate below
    }
    await this.kill()
  }

  /**
   * Send a message to the worker thread.
   *
   * @param payload - Data to send. Sent to worker thread.
   *
   * @example
   * ```typescript
   * worker.send({ action: "process", data: [1, 2, 3] });
   * ```
   * @public
   */
  send(payload: Record<string, unknown>) {
    if (this.exited) {
      throw new Error(`Worker ${this.threadId} has exited — cannot send message`)
    }
    this.thread.postMessage(payload)
  }

  /**
   * Make an RPC request to the worker thread.
   *
   * @param method - Method name to call in worker. Must exist on WorkerThreadInit.
   * @param params - Method parameters. Passed as array to worker method.
   * @param _wait - Wait for response. If false, fire-and-forget. Defaults to `true`.
   * @param _others - Additional RPC data. Merged into RPC payload.
   * @param timeoutMs - Optional timeout in milliseconds. Rejects the request
   *   when the worker does not respond in time.
   * @returns Promise resolving with worker response.
   *
   * @example
   * ```typescript
   * const result = await worker.request("processData", [[1, 2, 3]]);
   * console.log("Result:", result);
   * ```
   * @public
   */
  async request(method: string, params: unknown[], _wait = true, _others?: Record<string, unknown>, timeoutMs?: number) {
    return this.rpc.makeRequest(method, params, _wait, _others, timeoutMs)
  }
}
