

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleCaptionArgsVoice](./gramstax.ctx.handlecaptionargsvoice.md)

## Ctx.handleCaptionArgsVoice() method

Route function for `handleCaptionArgsVoice` with arg match intent `this.data.name`

**Signature:**

```typescript
/** @virtual */
handleCaptionArgsVoice?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by voice with caption and with arg.

## Example

this.data.name = "start 123 aaa"

```typescript
async handleCaptionArgsVoice() {
  this.msg?.voice // {...}
  this.msg?.caption // "start"
  this.msgCaptionArg // "123"
  this.msgCaptionArgs // ["123", "aaa"]
}
```

