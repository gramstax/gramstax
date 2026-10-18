---
title: "Gramstax.hookKeyGenerator()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Gramstax](./gramstax.gramstax.md) &gt; [hookKeyGenerator](./gramstax.gramstax.hookkeygenerator.md)

## Gramstax.hookKeyGenerator() method

Hook called to produce the per-update rate-limit key.

**Signature:**

```typescript
/** @virtual */
hookKeyGenerator?(ctx: ICtx): string | undefined;
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

ctx


</td><td>

ICtx


</td><td>

The page context instance for the update.


</td></tr>
</tbody></table>

**Returns:**

string \| undefined

The rate-limit key, or `undefined` to fall back to the default.

## Remarks

Optional class override. Default: the sender's user id. Override to group updates differently — e.g. per chat, per session, or a shared global bucket. Must be synchronous (the ratelimiter middleware reads the key before the update is dispatched). The context is a fully constructed page context.

## Example


```typescript
hookKeyGenerator(ctx: Ctx) {
  return `global`
}
```

