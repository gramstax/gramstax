import type {WorkerThreadInit} from "../init"

/**
 * Type-level carrier for the worker class a launched handle belongs to.
 *
 * @typeParam TInit - The worker class.
 *
 * @remarks
 * Purely phantom: the property is optional and never assigned at runtime. It
 * exists so a `launchWorker()` result still knows which worker class produced
 * it after it has crossed into an array, which is what lets
 * `new WorkerThreadPool(handles)` infer the class instead of demanding a type
 * argument.
 *
 * A plain `WorkerThreadLaunch` is still assignable to this type — the target
 * also requires the launch surface, so the optional-only "weak type" rule does
 * not apply.
 *
 * @public
 */
export type IWorkerThreadWorkerClass<TInit extends WorkerThreadInit> = {readonly __workerClass?: TInit}

/**
 * Per-worker outcome returned by `broadcastSettled`.
 *
 * @public
 */
export type IWorkerThreadPoolOutcome<TResult> = {
  threadId: number
  ok: boolean
  result?: TResult
  error?: unknown
}

/**
 * How a pool call is fanned out.
 *
 * - `execute` — one worker, round-robin. The default when `mode` is omitted.
 * - `broadcast` — every worker, fail-fast.
 * - `settled` — every worker, settled per worker; never rejects on a peer.
 *
 * @public
 */
export type IWorkerThreadPoolMode = "execute" | "broadcast" | "settled"

/**
 * Trailing options object accepted by every `mtd*` member of a pool.
 *
 * @typeParam TMode - The mode literal, used to pick the result shape.
 *
 * @remarks
 * This object is always the **last** argument. A worker method that itself
 * takes optional trailing parameters therefore reserves that position first,
 * and the caller must supply placeholders to reach the options:
 * `pool.mtdBroadcast(text, undefined, {mode: "broadcast"})`.
 *
 * @public
 */
export type IWorkerThreadPoolOptions<TMode extends IWorkerThreadPoolMode = IWorkerThreadPoolMode> = {
  mode?: TMode
  timeoutMs?: number
}

/**
 * Result shape produced by a call in a given mode.
 *
 * @internal
 */
export type IWorkerThreadPoolResult<TResult, TMode extends IWorkerThreadPoolMode> = TMode extends "settled"
  ? IWorkerThreadPoolOutcome<Awaited<TResult>>[]
  : TMode extends "broadcast"
    ? Awaited<TResult>[]
    : Awaited<TResult>

/**
 * The `mtd*` methods of a worker class, exposed as pool members.
 *
 * @typeParam TInit - The worker class whose methods should be callable.
 *
 * @remarks
 * Each member accepts the worker's own arguments followed by one optional
 * {@link IWorkerThreadPoolOptions}. The result type follows the mode, so
 * omitting `mode` yields a single value and naming it yields an array.
 *
 * If the `mode` argument is widened to `IWorkerThreadPoolMode` rather than a
 * literal, the result widens to a union of all three shapes. Pass the literal
 * at the call site to keep the precise type.
 *
 * Unlike `IWorkerThreadAsyncMethods`, this filters on the `mtd` prefix rather
 * than on membership of `WorkerThreadInit`. A pool is a fan-out surface, so a
 * worker's private helper should not become part of the pool's public API. The
 * runtime does not enforce the prefix (only `DENIED_RPC_METHODS` in `rpc.ts`
 * gates dispatch), so this is a readability surface, not a safety boundary.
 *
 * @public
 */
export type IWorkerThreadPoolMethods<TInit extends WorkerThreadInit> = {
  [K in keyof TInit as K extends `mtd${string}` ? K : never]: TInit[K] extends (...args: infer A) => infer R ? <TMode extends IWorkerThreadPoolMode = "execute">(...args: [...A, IWorkerThreadPoolOptions<TMode>?]) => Promise<IWorkerThreadPoolResult<R, TMode>> : never
}
