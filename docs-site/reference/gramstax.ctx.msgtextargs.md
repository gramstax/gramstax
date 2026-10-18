---
title: "Ctx.msgTextArgs"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [msgTextArgs](./gramstax.ctx.msgtextargs.md)

## Ctx.msgTextArgs property

All arg tokens parsed from message text.

**Signature:**

```typescript
get msgTextArgs(): string[];
```

## Remarks

Splits the message text by space separator starting from the configured position.

## Example


```typescript
// Message: "start 123 456"
async handleArgsText() {
  console.log(this.msgTextArgs) // ["123", "456"]
}
```

