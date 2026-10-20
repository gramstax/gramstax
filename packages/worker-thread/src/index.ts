/**
 * Worker thread export — top-level init, types, and aggregator.
 *
 * @remarks
 * Provides the {@link WorkerThreadExport} class that auto-detects
 * main-thread vs worker-thread context, launches workers, sets up RPC
 * proxies, and exposes type-safe method invocation across threads.
 *
 * The shared types live in `./types/export` and are re-exported from the
 * package barrel.
 *
 * @packageDocumentation
 * @public
 */

export * from "./error-handler"
export * from "./export"
export * from "./gateway-client"
export * from "./gateway-path"
export * from "./gateway-server"
export * from "./init"
export * from "./launch"
export * from "./pool"
export * from "./rpc"
// Type definitions live in `./types`, mirroring `lmdb/src/types`.
export type {IWorkerThreadAsyncMethods, IWorkerThreadExportOpt, IWorkerThreadExportResult, IWorkerThreadGatewayClientFactory, IWorkerThreadGatewayProxy} from "./types/export"
export type {IGatewayClientOptions} from "./types/gateway-client"
export type {IGatewayServerOptions} from "./types/gateway-server"
export type {IWorkerThreadPoolMethods, IWorkerThreadPoolMode, IWorkerThreadPoolOptions, IWorkerThreadPoolOutcome, IWorkerThreadWorkerClass} from "./types/pool"
export type {IMapRpc, IRpcContext, IRpcMiddleware} from "./types/rpc"
