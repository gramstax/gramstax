---
title: "Ctx.handleCommandCaptionPhoto()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleCommandCaptionPhoto](./gramstax.ctx.handlecommandcaptionphoto.md)

## Ctx.handleCommandCaptionPhoto() method

Route function for photoCaption with slash command match intent `this.data.name`

**Signature:**

```typescript
/** @virtual */
handleCommandCaptionPhoto?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by photo with caption command.

## Example

this.data.name = "/start" &amp;&amp; this.msg?.photo

```typescript
async handleCommandCaptionPhoto() {
  this.msg?.photo // {...}
  this.msg?.caption // "/start"
}
```

