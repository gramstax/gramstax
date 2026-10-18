---
title: "Ctx.cloneMediaInput()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [cloneMediaInput](./gramstax.ctx.clonemediainput.md)

## Ctx.cloneMediaInput() method

Clone a resolved media input so parallel broadcast sends never share one mutable instance.

**Signature:**

```typescript
static cloneMediaInput<T>(value: T, _roots?: readonly string[] | null): T;
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

value


</td><td>

T


</td><td>

Resolved media input (`string` or `InputFile`).


</td></tr>
<tr><td>

\_roots


</td><td>

readonly string\[\] \| null


</td><td>

_(Optional)_ Ignored; accepted so jail-forwarding call sites read uniformly.


</td></tr>
</tbody></table>

**Returns:**

T

A prototype-preserving shallow clone for `InputFile`, else `value` unchanged.

## Remarks

`resolveMediaInput` returns a pre-built `InputFile` as-is when no `filename` is given; sharing that single instance across concurrent `send*` calls risks interleaved stream state. Broadcast paths wrap every resolved value with this helper (per recipient, inside the worker), so each send owns its copy. Non-`InputFile` values (`string` sources) pass through unchanged. The trailing `roots` param exists for call-site uniformity with `resolveMediaInput` and is intentionally ignored — cloning never re-evaluates the jail.

