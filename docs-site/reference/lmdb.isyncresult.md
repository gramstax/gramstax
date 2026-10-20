---
title: "ISyncResult"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ISyncResult](./lmdb.isyncresult.md)

## ISyncResult interface

Result of [LmdbSyncStream](./lmdb.lmdbsyncstream.md).

**Signature:**

```typescript
interface ISyncResult<S extends typeof LmdbSchema = typeof LmdbSchema> 
```

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

[checkpoint](./lmdb.isyncresult.checkpoint.md)


</td><td>


</td><td>

[KeyOf](./lmdb.keyof.md)&lt;S&gt; \| undefined


</td><td>

Last copied key (`undefined` when nothing was copied).


</td></tr>
<tr><td>

[copied](./lmdb.isyncresult.copied.md)


</td><td>


</td><td>

number


</td><td>

Rows copied this run.


</td></tr>
<tr><td>

[verified](./lmdb.isyncresult.verified.md)


</td><td>


</td><td>

boolean


</td><td>

Whether the verify step ran clean.


</td></tr>
</tbody></table>

