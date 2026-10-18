

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleFreeContact](./gramstax.ctx.handlefreecontact.md)

## Ctx.handleFreeContact() method

Route handler for free-form contact input.

**Signature:**

```typescript
/** @virtual */
handleFreeContact?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by any contact not matching other routes, typically used with sessions.

## Example


```typescript
async handleFreeContact() {
   this.msg?.contact // {...}
}
```

