

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleCaptionDocument](./gramstax.ctx.handlecaptiondocument.md)

## Ctx.handleCaptionDocument() method

Route function for `handleCaptionDocument` match intent `this.data.name`

**Signature:**

```typescript
/** @virtual */
handleCaptionDocument?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by document with caption.

## Example

this.data.name = "start" &amp;&amp; this.msg?.document

```typescript
async handleCaptionDocument() {
  this.msg?.document // {...}
  this.msg?.caption // "start"
}
```

