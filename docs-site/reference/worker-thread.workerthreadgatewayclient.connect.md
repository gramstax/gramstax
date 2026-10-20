---
title: "WorkerThreadGatewayClient.connect()"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadGatewayClient](./worker-thread.workerthreadgatewayclient.md) &gt; [connect](./worker-thread.workerthreadgatewayclient.connect.md)

## WorkerThreadGatewayClient.connect() method

Connect to a gateway server.

**Signature:**

```typescript
connect(path: string, options?: IGatewayClientOptions): Promise<unknown>;
```

## Parameters

<table><thead><tr><th>

Parameter


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

path


</td><td>

string


</td><td>

Unix socket path. Matches server gateway.


</td></tr>
<tr><td>

options


</td><td>

[IGatewayClientOptions](./worker-thread.igatewayclientoptions.md)


</td><td>

_(Optional)_ Connection options (auth token, reconnect tuning, encoding).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;unknown&gt;

Promise that resolves to this client instance when connection is ready.

## Example


```typescript
await client.connect("/tmp/worker-server.sock", {
  token: "shared-secret",
  messagepack: true,
});
console.log("Connected to gateway server");
```

