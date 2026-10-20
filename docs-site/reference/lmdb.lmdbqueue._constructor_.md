---
title: "LmdbQueue.(constructor)"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbQueue](./lmdb.lmdbqueue.md) &gt; [(constructor)](./lmdb.lmdbqueue._constructor_.md)

## LmdbQueue.(constructor)

Create a queue bound to a schema's sub-DB.

**Signature:**

```typescript
constructor(_env: LmdbEnv, schema: S);
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

\_env


</td><td>

[LmdbEnv](./lmdb.lmdbenv.md)


</td><td>

Owning env (must stay open for the queue's lifetime).


</td></tr>
<tr><td>

schema


</td><td>

S


</td><td>

Payload schema class; its `static db` is the queue name and its key must be string-kind.


</td></tr>
</tbody></table>

## Remarks

Registration is idempotent: constructing a second queue with the same schema reuses the already-created sub instead of throwing.

