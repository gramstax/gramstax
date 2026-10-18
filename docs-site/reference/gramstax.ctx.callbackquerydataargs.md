---
title: "Ctx.callbackQueryDataArgs"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [callbackQueryDataArgs](./gramstax.ctx.callbackquerydataargs.md)

## Ctx.callbackQueryDataArgs property

All arg tokens parsed from callback data.

**Signature:**

```typescript
get callbackQueryDataArgs(): string[];
```

## Remarks

Splits the callback data by colon separator.

## Example


```typescript
// Callback: "menu:settings:ok"
async handleArgsCallback() {
  console.log(this.callbackQueryDataArgs) // ["settings", "ok"]
}
```

