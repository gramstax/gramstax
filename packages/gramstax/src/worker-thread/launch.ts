import {isMainThread, Worker} from "node:worker_threads"
import {WorkerThreadRpc} from "./rpc"

/**
 * Manages worker thread lifecycle from the main thread.
 * Handles spawning, communication, and termination of worker threads.
 *
 * @remarks
 * Automatically registers SIGINT/SIGTERM handlers to terminate workers.
 * Uses promise-based ready detection for synchronization.
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
export class WorkerThreadLaunch {
  /**
   * Check if currently running in the main thread.
   * Re-exported from `node:worker_threads`.
   *
   * @remarks
   * Uses `node:worker_threads:isMainThread` to guard main-thread only logic.
   */
  static isMainThread = isMainThread

  private _readyResolve?: () => void
  private _readyPromise = new Promise<void>((resolve) => (this._readyResolve = resolve))

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
  thread: Worker = {} as any

  /**
   * The worker thread ID.
   *
   * @remarks
   * Matches `new node:worker_threads:worker().threadId`.
   */
  threadId: number = {} as any

  /**
   * RPC handler for method invocations.
   *
   * @remarks
   * Uses {@link WorkerThreadRpc} for request/response messaging.
   */
  rpc: WorkerThreadRpc = {} as any

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
    public argv: any[],
    public register?: any
  ) {
    this.init()
    if (!register) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      register = this
    }
    this.rpc = new WorkerThreadRpc(this.send.bind(this), register)
  }

  /**
   * Wait for the worker to signal it's ready.
   *
   * @returns Promise that resolves when worker calls `super()` in `WorkerThreadInit`.
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
   * Internal method called by worker to signal readiness.
   * @public
   */
  readyResolve() {
    this._readyResolve?.()
  }

  /**
   * Initialize the worker thread and set up message handlers.
   * @public
   */
  init() {
    this.thread = new Worker(this.path, {argv: this.argv.length == 0 && this.argv[0] === undefined ? undefined : this.argv})
    this.threadId = this.thread.threadId
    this.thread.on(`message`, (data) => this.handleOnMessage(data))
    this.thread.on(`exit`, () => this.kill())
    process.once(`SIGINT`, () => this.kill())
    process.once(`SIGTERM`, () => this.kill())
  }

  /**
   * Handle incoming messages from the worker thread.
   *
   * @param data - Message data from worker.
   * @public
   */
  async handleOnMessage(data: any) {
    this.rpc.make(data)
  }

  /**
   * Terminate the worker thread immediately.
   *
   * @example
   * ```typescript
   * worker.kill();
   * ```
   * @public
   */
  kill() {
    this.thread.terminate()
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
  send(payload: any) {
    this.thread.postMessage(payload)
  }

  /**
   * Make an RPC request to the worker thread.
   *
   * @param method - Method name to call in worker. Must exist on WorkerThreadInit.
   * @param params - Method parameters. Passed as array to worker method.
   * @param _wait - Wait for response. If false, fire-and-forget. Defaults to `true`.
   * @param _others - Additional RPC data. Merged into RPC payload.
   * @returns Promise resolving with worker response.
   *
   * @example
   * ```typescript
   * const result = await worker.request("processData", [[1, 2, 3]]);
   * console.log("Result:", result);
   * ```
   * @public
   */
  async request(method: string, params: any, _wait = true, _others?: any) {
    return this.rpc.makeRequest(method, params, _wait, _others)
  }
}
