

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [renderShipping](./gramstax.ctx.rendershipping.md)

## Ctx.renderShipping() method

Answers the active shipping query with a template-backed error message.

Template block: `<g-shipping-error>` (read via `getGShippingError`).

**Signature:**

```typescript
renderShipping(params: IRenderShippingParams): Promise<true>;
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

params


</td><td>

[IRenderShippingParams](./gramstax.irendershippingparams.md)


</td><td>

Answer params: `ok` whether the shipping address is acceptable (required); `data` optional template interpolation data (or null to omit); `AGBaseId` optional template base ID position for the error message (or null to use default); `options` optional answer options such as `shipping_options` (or null to omit).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;true&gt;

True on success.

## Remarks

The `<g-shipping-error>` block supplies the `error_message` shown when the shipping address is rejected (multilang via `data`). The block is always resolved — even for `ok=true` — as fail-fast validation that the template exists.

Observe-only send-error coverage (mirrors `renderPreCheckout`): failures are classified via `Ctx.classifySendError`, reported to `notifySendError`, and logged (`retryable` → `log.error`, `fallback-text` → `log.warn`). After notify+log the original error is ALWAYS rethrown untouched.

## Example


```typescript
async handleShipping() {
  await this.renderShipping({ok: false, AGBaseId: `ship-rejected-card`})
}
```

