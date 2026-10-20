---
title: "LmdbJobRunMissedOptions"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbJobRunMissedOptions](./lmdb.lmdbjobrunmissedoptions.md)

## LmdbJobRunMissedOptions interface

Options for [LmdbJobRun.missed()](./lmdb.lmdbjobrun.missed.md).

**Signature:**

```typescript
interface IJobRunMissedOptions 
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

[now?](./lmdb.lmdbjobrunmissedoptions.now.md)


</td><td>


</td><td>

number


</td><td>

_(Optional)_ Clock override in epoch ms (default `Date.now()`).


</td></tr>
<tr><td>

[pattern](./lmdb.lmdbjobrunmissedoptions.pattern.md)


</td><td>


</td><td>

string


</td><td>

Cron expression the job is scheduled on.


</td></tr>
<tr><td>

[timezone?](./lmdb.lmdbjobrunmissedoptions.timezone.md)


</td><td>


</td><td>

string


</td><td>

_(Optional)_ IANA timezone for `pattern` (default: the host's local timezone).


</td></tr>
</tbody></table>

