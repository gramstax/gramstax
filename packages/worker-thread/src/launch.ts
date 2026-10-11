import {EventEmitter} from "node:events"
import {isMainThread, Worker} from "node:worker_threads"
import {WorkerThreadErrorHandler} from "./error-handler"
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
 * import { WorkerThreadLaunch } from "@gramstax/worker-thread";
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
 * import { WorkerThreadLaunch } from "@gramstax/worker-thread";
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
 * import {WorkerThreadInit} from "@gramstax/worker-thread";
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
 *   WTInit: Worker,
 * });
 * ```
 *
 * @public
 */
export class WorkerThreadLaunch extends EventEmitter {
  /**
   * Whether the worker has signalled ready. Makes `readyResolve()` one-shot.
   *
   * @remarks
   * Checked by `readyResolve()` and the `exit` handler so `ready()` resolves
   * once or rejects when the worker exits before signalling ready.
   */
  private _readyResolved = false
  /** Resolve function captured by the `_readyPromise` executor. Invoked once by `readyResolve()`. */
  private _readyResolve?: () => void
  /** Reject function captured by the `_readyPromise` executor. Invoked when the worker exits before signalling ready. */
  private _readyReject?: (err: Error) => void
  /**
   * Promise returned by `ready()`. Settles when the worker signals ready or exits early.
   *
   * @remarks
   * The executor captures `_readyResolve`/`_readyReject`; resolution is
   * one-shot via `_readyResolved`.
   */
  private _readyPromise = new Promise<void>((resolve, reject) => {
    this._readyResolve = resolve
    this._readyReject = reject
  })

  /** Whether the worker thread has exited. Guards `kill()` against double-termination hangs. */
  private _exited = false

  /**
   * Set synchronously at the top of `kill()`/`shutdown()` so `send()`/`request()`
   * fail fast instead of hanging while termination is in flight.
   */
  private _exiting = false

  /** Exit code from the worker `exit` event, if it has fired. */
  private _exitCode?: number

  /** In-flight `shutdown()` promise shared by concurrent callers (single drain). */
  private _shutdownPromise?: Promise<void>

  /** Bound SIGINT/SIGTERM handlers so `kill()`/`exit` can remove them (no pool leak). */
  private _sigintHandler?: () => void
  /** Retained `SIGTERM` listener registered in `init()` so `_removeSignalHandlers()` can detach it. */
  private _sigtermHandler?: () => void

  /**
   * Detach the SIGINT/SIGTERM handlers registered in `init()`.
   *
   * @remarks
   * Called from `kill()` and the `exit` handler so worker pools stop
   * accumulating `MaxListenersExceededWarning`s.
   */
  private _removeSignalHandlers() {
    if (this._sigintHandler) {
      process.removeListener(`SIGINT`, this._sigintHandler)
      this._sigintHandler = undefined
    }
    if (this._sigtermHandler) {
      process.removeListener(`SIGTERM`, this._sigtermHandler)
      this._sigtermHandler = undefined
    }
  }

  /**
   * Emit an `error` event without risking an uncaught throw.
   *
   * @remarks
   * Node's `EventEmitter` throws when `error` is emitted with no listeners,
   * which would crash the process for a recoverable worker error. With
   * listeners, the error is emitted; without, it is routed to the
   * package-wide handler set via `WorkerThreadErrorHandler.setDefault` (silent by
   * default — library code never writes to the console).
   *
   * @param err - The error to emit (or report).
   */
  private _safeEmitError(err: unknown) {
    if (this.listenerCount(`error`) > 0) {
      this.emit(`error`, err)
    } else {
      WorkerThreadErrorHandler.report(err)
    }
  }

  /**
   * Check if currently running in the main thread.
   * Re-exported from `node:worker_threads`.
   *
   * @remarks
   * Uses `node:worker_threads:isMainThread` to guard main-thread only logic.
   */
  static isMainThread = isMainThread

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
    // Argv slot convention: `export` reserves process.argv[2] for its routing
    // token (`for-<path>`); raw launch args start at argv[2] and user args
    // follow at argv[3]+. Normalize explicit [undefined]/empty to no-args so a
    // worker never self-misdetects (which would cause a nested spawn).
    if (this.argv.length === 0 || (this.argv.length === 1 && this.argv[0] === undefined)) {
      this.argv = []
    }
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
    // A stale resolve after death is misleading — callers polling ready()
    // on a dead worker must learn it died instead of hanging on success.
    if (this._exited) {
      return Promise.reject(new Error(`Worker ${this.threadId} has exited (code ${this._exitCode}) — ready() cannot resolve after death`))
    }
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
    this.thread = new Worker(this.path, {argv: this.argv.length === 0 ? undefined : this.argv})
    this.threadId = this.thread.threadId
    this.thread.on(`message`, (data) => this.handleOnMessage(data))
    this.thread.on(`error`, (err) => this._safeEmitError(err))
    this.thread.on(`exit`, (code) => {
      this.rpc.rejectAllPending(new Error(`Worker ${this.threadId} exited unexpectedly (code ${code})`))
      if (!this._readyResolved) {
        this._readyReject?.(new Error(`Worker ${this.threadId} exited before signaling ready (code ${code})`))
      }
      this._exited = true
      this._exitCode = code
      this.emit(`exit`, code)
      // Dead kill() removed: it short-circuits on `exited`, so it could never act here.
      this._removeSignalHandlers()
    })
    this._sigintHandler = () => {
      void this.kill()
    }
    this._sigtermHandler = () => {
      void this.kill()
    }
    process.once(`SIGINT`, this._sigintHandler)
    process.once(`SIGTERM`, this._sigtermHandler)
  }

  /**
   * [LOW-LEVEL] Handle incoming messages from the worker thread.
   *
   * @param data - Message data from worker.
   * @public
   */
  async handleOnMessage(data: Parameters<WorkerThreadRpc[`make`]>[0]) {
    this.rpc.make(data).catch((err: unknown) => {
      this._safeEmitError(err)
    })
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
    this._exiting = true
    this._removeSignalHandlers()
    if (this._exited) return Promise.resolve()
    // terminate() can reject when the thread is already mid-exit — kill stays
    // best-effort, but the failure is routed to the `error` event (or the
    // default handler) instead of being swallowed silently
    return this.thread.terminate().catch((err: unknown) => {
      this._safeEmitError(err)
    })
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
    // Fast-path: an exited worker needs no RPC and no 5s stall.
    if (this._exited) return
    // Serialize: concurrent callers share one in-flight drain.
    if (this._shutdownPromise) return this._shutdownPromise
    this._exiting = true
    this._shutdownPromise = (async () => {
      // The drain bypasses the public send() guard (which rejects while
      // `exiting` is set) by posting straight to the thread — the reply is
      // still routed through this.rpc, so the pending map resolves normally.
      const rpcSend = this.rpc.send
      this.rpc.send = (data) => this.thread.postMessage(data)
      try {
        // Direct rpc call: the public request() guard below would reject
        // while `exiting` is set, but the drain itself must still go out.
        await this.rpc.makeRequest(`shutdown`, [], true, undefined, timeoutMs)
      } catch {
        // worker may be unresponsive or already gone — force terminate below
      } finally {
        this.rpc.send = rpcSend
      }
      await this.kill()
    })().finally(() => {
      this._shutdownPromise = undefined
    })
    return this._shutdownPromise
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
    if (this._exited) {
      throw new Error(`Worker ${this.threadId} has exited — cannot send message`)
    }
    if (this._exiting) {
      throw new Error(`Worker ${this.threadId} is exiting — cannot send message`)
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
    if (this._exited) {
      throw new Error(`Worker ${this.threadId} has exited — cannot send request "${method}"`)
    }
    if (this._exiting) {
      throw new Error(`Worker ${this.threadId} is exiting — cannot send request "${method}"`)
    }
    return this.rpc.makeRequest(method, params, _wait, _others, timeoutMs)
  }
}
