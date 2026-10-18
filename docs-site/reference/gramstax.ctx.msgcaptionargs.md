

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [msgCaptionArgs](./gramstax.ctx.msgcaptionargs.md)

## Ctx.msgCaptionArgs property

All arg tokens parsed from caption text.

**Signature:**

```typescript
get msgCaptionArgs(): string[];
```

## Example


```typescript
// Caption: "start 123 456"
async handleCaptionArgsPhoto() {
  console.log(this.msgCaptionArgs) // ["123", "456"]
}
```

