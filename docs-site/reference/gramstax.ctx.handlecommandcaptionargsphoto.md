

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleCommandCaptionArgsPhoto](./gramstax.ctx.handlecommandcaptionargsphoto.md)

## Ctx.handleCommandCaptionArgsPhoto() method

Route function for `handleCommandCaptionArgsPhoto` with slash command and arg match intent `this.data.name`

**Signature:**

```typescript
/** @virtual */
handleCommandCaptionArgsPhoto?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by photo with caption command and args.

## Example

this.data.name = "/start 123 aaa" &amp;&amp; this.msg?.photo

```typescript
async handleCommandCaptionArgsPhoto() {
  this.msg?.photo // {...}
  this.msg?.caption // "/start 123 aaa"
  this.msgCaptionArg // "123"
  this.msgCaptionArgs // ["123", "aaa"]
}
```

