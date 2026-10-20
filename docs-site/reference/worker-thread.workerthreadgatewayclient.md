---
title: "WorkerThreadGatewayClient"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadGatewayClient](./worker-thread.workerthreadgatewayclient.md)

## WorkerThreadGatewayClient class

\[LOW-LEVEL\] Provides IPC client functionality for inter-worker communication using Unix domain sockets.

**Signature:**

```typescript
declare class WorkerThreadGatewayClient extends EventEmitter 
```
**Extends:** EventEmitter

## Remarks

Provides IPC client functionality for inter-worker communication using Unix domain sockets (named pipes on Windows). Created internally by [WorkerThreadInit.createGatewayClient()](./worker-thread.workerthreadinit.creategatewayclient.md).

Uses the `net-ipc` library for Unix domain socket communication. Works in \*\*Bun\*\* (native) and \*\*Node.js\*\* (native).

## Constructors

<table><thead><tr><th>

Constructor


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[(constructor)()](./worker-thread.workerthreadgatewayclient._constructor_.md)


</td><td>


</td><td>

Creates a new gateway client instance.


</td></tr>
</tbody></table>

## Properties

<table><thead><tr><th>

Property


</th><th>

Modifiers


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[client](./worker-thread.workerthreadgatewayclient.client.md)


</td><td>


</td><td>

Client


</td><td>

The underlying `net-ipc` Client instance.


</td></tr>
<tr><td>

[rpc](./worker-thread.workerthreadgatewayclient.rpc.md)


</td><td>


</td><td>

[WorkerThreadRpc](./worker-thread.workerthreadrpc.md)


</td><td>

RPC handler for messaging.


</td></tr>
</tbody></table>

## Methods

<table><thead><tr><th>

Method


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[close()](./worker-thread.workerthreadgatewayclient.close.md)


</td><td>


</td><td>

Close the connection permanently.


</td></tr>
<tr><td>

[connect(path, options)](./worker-thread.workerthreadgatewayclient.connect.md)


</td><td>


</td><td>

Connect to a gateway server.


</td></tr>
<tr><td>

[destroy()](./worker-thread.workerthreadgatewayclient.destroy.md)


</td><td>


</td><td>

Destroy the connection immediately without a graceful close.


</td></tr>
<tr><td>

[isClosed()](./worker-thread.workerthreadgatewayclient.isclosed.md)


</td><td>


</td><td>

Whether the connection has been closed or destroyed.


</td></tr>
<tr><td>

[request(method, params, \_wait, \_others, timeoutMs)](./worker-thread.workerthreadgatewayclient.request.md)


</td><td>


</td><td>

Make an RPC request to the server.


</td></tr>
</tbody></table>

