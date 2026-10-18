

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleText](./gramstax.ctx.handletext.md)

## Ctx.handleText() method

Route handler for text messages matching `intentText`.

**Signature:**

```typescript
/** @virtual */
handleText?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by exact text match.

## Example


```typescript
// text = "start"
// validate "start" from mapping hash
async handleText() {
   this.msg?.text // "start"
}
```

