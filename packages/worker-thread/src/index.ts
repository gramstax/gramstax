/**
 * @gramstax/worker-thread — multi-threaded task execution with RPC.
 *
 * @remarks
 * Provides worker thread lifecycle management (main thread → worker),
 * inter-worker IPC (Unix sockets via net-ipc), and type-safe RPC
 * proxies that transform class methods into async RPC calls.
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
