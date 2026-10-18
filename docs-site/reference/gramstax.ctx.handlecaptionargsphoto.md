---
title: "Ctx.handleCaptionArgsPhoto()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleCaptionArgsPhoto](./gramstax.ctx.handlecaptionargsphoto.md)

## Ctx.handleCaptionArgsPhoto() method

Route function for photoCaption with arg match intent `this.data.name`

**Signature:**

```typescript
/** @virtual */
handleCaptionArgsPhoto?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by photo with caption and with arg.

## Example

this.data.name = "start 123 aaa" &amp;&amp; this.msg?.photo

```typescript
async handleCaptionArgsPhoto() {
  this.msg?.photo // {...}
  this.msg?.caption // "start"
  this.msgCaptionArg // "123"
  this.msgCaptionArgs // ["123", "aaa"]
}
```

