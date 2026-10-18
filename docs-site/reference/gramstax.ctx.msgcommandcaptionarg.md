---
title: "Ctx.msgCommandCaptionArg"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [msgCommandCaptionArg](./gramstax.ctx.msgcommandcaptionarg.md)

## Ctx.msgCommandCaptionArg property

The first arg token from a caption command.

**Signature:**

```typescript
get msgCommandCaptionArg(): string;
```

## Example


```typescript
// Caption: "/photo 123"
async handleCommandCaptionArgsPhoto() {
  console.log(this.msgCommandCaptionArg) // "123"
}
```

