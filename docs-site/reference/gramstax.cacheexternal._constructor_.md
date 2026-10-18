---
title: "CacheExternal.(constructor)"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [CacheExternal](./gramstax.cacheexternal.md) &gt; [(constructor)](./gramstax.cacheexternal._constructor_.md)

## CacheExternal.(constructor)

Creates a new CacheExternal instance.

**Signature:**

```typescript
constructor(url?: string, ttl?: number, namespace?: string, more?: IMore);
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

url


</td><td>

string


</td><td>

_(Optional)_ Storage connection URL. Use `"memory"` for in-memory storage or `"redis://..."` for Redis.


</td></tr>
<tr><td>

ttl


</td><td>

number


</td><td>

_(Optional)_ Default time-to-live in milliseconds. Applies to all keys unless overridden per operation.


</td></tr>
<tr><td>

namespace


</td><td>

string


</td><td>

_(Optional)_ Key namespace prefix. Isolates keys by namespace.


</td></tr>
<tr><td>

more


</td><td>

IMore


</td><td>

_(Optional)_ Additional Keyv options. Use `forceStore` to override automatic store selection.


</td></tr>
</tbody></table>

