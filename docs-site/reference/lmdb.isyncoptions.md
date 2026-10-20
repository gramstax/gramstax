---
title: "ISyncOptions"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ISyncOptions](./lmdb.isyncoptions.md)

## ISyncOptions interface

Options for [LmdbSyncStream](./lmdb.lmdbsyncstream.md).

**Signature:**

```typescript
interface ISyncOptions<S extends typeof LmdbSchema = typeof LmdbSchema> 
```

## Remarks

Every field is optional — omitted fields select the default full verified copy under the destination-db stream name.

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

[checkpoint?](./lmdb.isyncoptions.checkpoint.md)


</td><td>


</td><td>

[KeyOf](./lmdb.keyof.md)&lt;S&gt;


</td><td>

_(Optional)_ One-shot exclusive lower bound (ignores and preserves the stored cursor).


</td></tr>
<tr><td>

[limit?](./lmdb.isyncoptions.limit.md)


</td><td>


</td><td>

number


</td><td>

_(Optional)_ Maximum rows copied this run (a truncated run reports `verified: false`).


</td></tr>
<tr><td>

[name?](./lmdb.isyncoptions.name.md)


</td><td>


</td><td>

string


</td><td>

_(Optional)_ Stream name for the persisted cursor (defaults to the destination db).


</td></tr>
<tr><td>

[verify?](./lmdb.isyncoptions.verify.md)


</td><td>


</td><td>

boolean


</td><td>

_(Optional)_ Run the count+hash verify step (default `true`).


</td></tr>
</tbody></table>

