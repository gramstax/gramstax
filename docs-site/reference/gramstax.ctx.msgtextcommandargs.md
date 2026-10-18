---
title: "Ctx.msgTextCommandArgs"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [msgTextCommandArgs](./gramstax.ctx.msgtextcommandargs.md)

## Ctx.msgTextCommandArgs property

All arg tokens from a command message.

**Signature:**

```typescript
get msgTextCommandArgs(): string[];
```

## Remarks

Splits the message text by space separator starting from position 1.

## Example


```typescript
// Message: "/start 123 456"
async handleCommandArgsText() {
  console.log(this.msgTextCommandArgs) // ["123", "456"]
}
```

