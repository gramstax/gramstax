

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRenderPreCheckoutParams](./gramstax.irenderprecheckoutparams.md)

## IRenderPreCheckoutParams type

Parameters for `renderPreCheckout`.

**Signature:**

```typescript
type IRenderPreCheckoutParams = {
    ok: boolean;
    data?: IData | null;
    AGBaseId?: string | null;
    options?: IOptPreCheckout | null;
};
```
**References:** [IData](./gramstax.idata.md), [IOptPreCheckout](./gramstax.ioptprecheckout.md)

## Remarks

Template-backed counterpart to [Ctx.answerPreCheckout()](./gramstax.ctx.answerprecheckout.md): the `<g-precheckout-error>` block supplies the `error_message` shown when payment is declined. Telegram requires the answer within 10 seconds of the query.

