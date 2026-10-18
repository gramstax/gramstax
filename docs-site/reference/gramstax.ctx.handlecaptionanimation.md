

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleCaptionAnimation](./gramstax.ctx.handlecaptionanimation.md)

## Ctx.handleCaptionAnimation() method

Route function for animationCaption match intent `this.data.name`

**Signature:**

```typescript
/** @virtual */
handleCaptionAnimation?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by animation with caption.

## Example

this.data.name = "start"

```typescript
async handleCaptionAnimation() {
  this.msg?.animation // {...}
  this.msg?.caption // "start"
}
```

