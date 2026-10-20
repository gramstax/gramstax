---
title: "worker-thread"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md)

## worker-thread package

## Classes

<table><thead><tr><th>

Class


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[WorkerThreadErrorHandler](./worker-thread.workerthreaderrorhandler.md)


</td><td>

Package-wide error routing for worker threads.


</td></tr>
<tr><td>

[WorkerThreadExport](./worker-thread.workerthreadexport.md)


</td><td>

Provides a unified interface for creating and managing worker threads with automatic RPC proxying.


</td></tr>
<tr><td>

[WorkerThreadGatewayClient](./worker-thread.workerthreadgatewayclient.md)


</td><td>

\[LOW-LEVEL\] Provides IPC client functionality for inter-worker communication using Unix domain sockets.


</td></tr>
<tr><td>

[WorkerThreadGatewayPath](./worker-thread.workerthreadgatewaypath.md)


</td><td>

Gateway socket path normalization.


</td></tr>
<tr><td>

[WorkerThreadGatewayServer](./worker-thread.workerthreadgatewayserver.md)


</td><td>

\[LOW-LEVEL\] Provides IPC server functionality for inter-worker communication using Unix domain sockets.


</td></tr>
<tr><td>

[WorkerThreadInit](./worker-thread.workerthreadinit.md)


</td><td>

Base class for worker thread implementations. Handles communication with the main thread and provides RPC functionality.


</td></tr>
<tr><td>

[WorkerThreadLaunch](./worker-thread.workerthreadlaunch.md)


</td><td>

Manages worker thread lifecycle from the main thread. Handles spawning, communication, and termination of worker threads.


</td></tr>
<tr><td>

[WorkerThreadRpc](./worker-thread.workerthreadrpc.md)


</td><td>

\[LOW-LEVEL\] Handles JSON-RPC style communication between threads.


</td></tr>
</tbody></table>

## Variables

<table><thead><tr><th>

Variable


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[DEFAULT\_MAX\_MESSAGE\_SIZE](./worker-thread.default_max_message_size.md)


</td><td>

Default cap on the estimated in-memory size of a single RPC message received over the gateway. Prevents an oversized (or maliciously framed) payload from exhausting worker memory. The parentPort channel is trusted and intentionally not capped.


</td></tr>
<tr><td>

[DEFAULT\_REQUEST\_TIMEOUT\_MS](./worker-thread.default_request_timeout_ms.md)


</td><td>

Default timeout in milliseconds applied to every `makeRequest` call that does not pass an explicit `timeoutMs`. `0` disables the timeout (requests wait indefinitely). Can be overridden per instance via `defaultTimeoutMs` or per call via `timeoutMs`.


</td></tr>
<tr><td>

[DENIED\_RPC\_METHODS](./worker-thread.denied_rpc_methods.md)


</td><td>

Method names that are never remotely callable, even when they resolve to a function on the register object. Covers prototype gadgets (`constructor` would expose the class) and the duplex plumbing (`send`/`request`/`kill`/gateway factories are outgoing-only APIs — `shutdown` and `readyResolve` stay allowed: they are the legitimate inbound lifecycle methods).


</td></tr>
<tr><td>

[WorkerThreadPool](./worker-thread.workerthreadpool.md)


</td><td>

Pool of workers of one worker class, with that class's `mtd*` methods callable directly on the instance.


</td></tr>
</tbody></table>

## Type Aliases

<table><thead><tr><th>

Type Alias


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[IGatewayClientOptions](./worker-thread.igatewayclientoptions.md)


</td><td>

Options for connecting a gateway client.


</td></tr>
<tr><td>

[IGatewayServerOptions](./worker-thread.igatewayserveroptions.md)


</td><td>

Options for starting a gateway server.


</td></tr>
<tr><td>

[IMapRpc](./worker-thread.imaprpc.md)


</td><td>

Map type for storing pending RPC request handlers.


</td></tr>
<tr><td>

[IRpcContext](./worker-thread.irpccontext.md)


</td><td>

Context object passed through the RPC middleware chain for incoming requests.


</td></tr>
<tr><td>

[IRpcMiddleware](./worker-thread.irpcmiddleware.md)


</td><td>

Middleware function for intercepting incoming RPC requests.


</td></tr>
<tr><td>

[IWorkerThreadAsyncMethods](./worker-thread.iworkerthreadasyncmethods.md)


</td><td>

Async methods type for worker thread. Transforms all worker methods to return Promises.


</td></tr>
<tr><td>

[IWorkerThreadExportOpt](./worker-thread.iworkerthreadexportopt.md)


</td><td>

Options for initializing a worker thread export.


</td></tr>
<tr><td>

[IWorkerThreadExportResult](./worker-thread.iworkerthreadexportresult.md)


</td><td>

Result type of [WorkerThreadExport.init()](./worker-thread.workerthreadexport.init.md).


</td></tr>
<tr><td>

[IWorkerThreadGatewayClientFactory](./worker-thread.iworkerthreadgatewayclientfactory.md)


</td><td>

Factory type for `launchGatewayClient` returned by [WorkerThreadExport.init()](./worker-thread.workerthreadexport.init.md).


</td></tr>
<tr><td>

[IWorkerThreadGatewayProxy](./worker-thread.iworkerthreadgatewayproxy.md)


</td><td>

Proxy type for gateway client methods. Transforms worker methods to accept `owner` as first parameter.


</td></tr>
<tr><td>

[IWorkerThreadPoolMethods](./worker-thread.iworkerthreadpoolmethods.md)


</td><td>

The `mtd*` methods of a worker class, exposed as pool members.


</td></tr>
<tr><td>

[IWorkerThreadPoolMode](./worker-thread.iworkerthreadpoolmode.md)


</td><td>

How a pool call is fanned out.

- `execute` — one worker, round-robin. The default when `mode` is omitted. - `broadcast` — every worker, fail-fast. - `settled` — every worker, settled per worker; never rejects on a peer.


</td></tr>
<tr><td>

[IWorkerThreadPoolOptions](./worker-thread.iworkerthreadpooloptions.md)


</td><td>

Trailing options object accepted by every `mtd*` member of a pool.


</td></tr>
<tr><td>

[IWorkerThreadPoolOutcome](./worker-thread.iworkerthreadpooloutcome.md)


</td><td>

Per-worker outcome returned by `broadcastSettled`.


</td></tr>
<tr><td>

[IWorkerThreadWorkerClass](./worker-thread.iworkerthreadworkerclass.md)


</td><td>

Type-level carrier for the worker class a launched handle belongs to.


</td></tr>
<tr><td>

[WorkerThreadPool](./worker-thread.workerthreadpool.md)


</td><td>

Type of a [WorkerThreadPool](./worker-thread.workerthreadpool.md) instance: the registry plus the worker class's `mtd*` dispatch surface.


</td></tr>
</tbody></table>

