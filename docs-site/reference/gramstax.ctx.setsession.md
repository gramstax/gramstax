

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [setSession](./gramstax.ctx.setsession.md)

## Ctx.setSession() method

\[LOW-LEVEL\] Sets session data for the current user.

**Signature:**

```typescript
setSession(method: string | string[], params?: Record<string, unknown>, moreRoot?: Record<string, unknown>): Promise<boolean | null>;
```

## Parameters

<table><thead><tr><th>

Parameter


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

method


</td><td>

string \| string\[\]


</td><td>

Route method name(s). Use `this.methodSession*()` helpers  for type-safe names, not a hardcoded string.


</td></tr>
<tr><td>

params


</td><td>

Record&lt;string, unknown&gt;


</td><td>

_(Optional)_ The session parameters to store.


</td></tr>
<tr><td>

moreRoot


</td><td>

Record&lt;string, unknown&gt;


</td><td>

_(Optional)_ Additional root-level properties to merge.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;boolean \| null&gt;

True if the session was set successfully, or null on error.

## Remarks

Low-level API. In most cases use the shorthand `setSession*` methods instead (e.g. [Ctx.setSessionFreeText()](./gramstax.ctx.setsessionfreetext.md), [Ctx.setSessionCallbackQueryData()](./gramstax.ctx.setsessioncallbackquerydata.md)).

This method is only needed when: - \*\*Multi-session\*\* — binding the same params to multiple route handlers at once:  `setSession([methodSessionFreeVideo(), methodSessionFreeText()], params)` - \*\*Dynamic method name\*\* — method string is computed at runtime  rather than known at dev-time, so `methodSession*()` cannot be called.

## Example


```typescript
// ❌ Avoid — use setSessionFreeText({...}) instead
await this.setSession(this.methodSessionFreeText(), {step: "awaiting_name"})

// ✅ Multi-session — bind one payload to two listeners
await this.setSession(
  [this.methodSessionFreeVideo(), this.methodSessionFreeText()],
  {mediaId: "abc123"}
)
```

