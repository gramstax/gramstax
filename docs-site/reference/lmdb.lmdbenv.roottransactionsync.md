---
title: "LmdbEnv.rootTransactionSync()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnv](./lmdb.lmdbenv.md) &gt; [rootTransactionSync](./lmdb.lmdbenv.roottransactionsync.md)

## LmdbEnv.rootTransactionSync() method

Execute a synchronous transaction.

**Signature:**

```typescript
rootTransactionSync<T>(action: () => T, flags?: TransactionFlags): T;
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

action


</td><td>

() =&gt; T


</td><td>

Callback performing reads and writes.


</td></tr>
<tr><td>

flags


</td><td>

TransactionFlags


</td><td>

_(Optional)_ `TransactionFlags` (abortable, synchronous-commit, etc.).


</td></tr>
</tbody></table>

**Returns:**

T

The callback's return value.

