

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleCommandCaptionAnimation](./gramstax.ctx.handlecommandcaptionanimation.md)

## Ctx.handleCommandCaptionAnimation() method

Route function for animationCaption with slash command match intent `this.data.name`

**Signature:**

```typescript
/** @virtual */
handleCommandCaptionAnimation?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by animation with caption command.

## Example

this.data.name = "/start"

```typescript
async handleCommandCaptionAnimation() {
  this.msg?.animation // {...}
  this.msg?.caption // "/start"
}
```

