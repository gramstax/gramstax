---
title: "Ctx.handleCommandArgsText()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleCommandArgsText](./gramstax.ctx.handlecommandargstext.md)

## Ctx.handleCommandArgsText() method

Route handler for command messages with args match intent `intentCommandText`.

**Signature:**

```typescript
/** @virtual */
handleCommandArgsText?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by text with commands slash with args.

## Example


```typescript
// text = "/start 123 aaa"
// validate "123" or "aaa" accoridng "/start" from mapping hash
async handleCommandArgsText() {
   this.msg?.text // "/start 123 aaa"
   this.msgTextArg // "123"
   this.msgTextArgs // ["123", "aaa"]
}
```

