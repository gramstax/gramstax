---
title: "LmdbEnv.pruneCdc()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnv](./lmdb.lmdbenv.md) &gt; [pruneCdc](./lmdb.lmdbenv.prunecdc.md)

## LmdbEnv.pruneCdc() method

Delete outbox records at or below the retention cutoff.

**Signature:**

```typescript
pruneCdc(keep?: number): Promise<number>;
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

keep


</td><td>

number


</td><td>

_(Optional)_ Newest entries to retain regardless of acks (default `10000`).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;number&gt;

The number of records removed.

## Exceptions

[LmdbError](./lmdb.lmdberror.md) On negative keeps.

## Remarks

Cutoff is `min(minAck, newest - keep)`: entries consumed by every registered consumer go, the newest `keep` entries always stay, and an unacked consumer blocks pruning below its start. With no consumers the keep window alone bounds growth — call periodically (like `purgeExpired`) when producing without persistent followers.

