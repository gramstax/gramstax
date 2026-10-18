

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleFreeSticker](./gramstax.ctx.handlefreesticker.md)

## Ctx.handleFreeSticker() method

Route handler for free-form sticker input.

**Signature:**

```typescript
/** @virtual */
handleFreeSticker?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by any sticker not matching other routes, typically used with sessions.

## Example


```typescript
async handleFreeSticker() {
   this.msg?.sticker // {...}
}
```

