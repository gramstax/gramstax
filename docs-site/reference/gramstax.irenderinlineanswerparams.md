

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRenderInlineAnswerParams](./gramstax.irenderinlineanswerparams.md)

## IRenderInlineAnswerParams type

Parameters for `renderInlineAnswer`.

**Signature:**

```typescript
type IRenderInlineAnswerParams = {
    results: readonly InlineQueryResult[];
    data?: IData | null;
    AGBaseId?: string | null;
    options?: IOptInlineAnswer | null;
    buttonStartParameter?: string | null;
};
```
**References:** [IData](./gramstax.idata.md), [IOptInlineAnswer](./gramstax.ioptinlineanswer.md)

## Remarks

Result contents are built by the caller from `data` (multilang payloads); the `<g-inline-button>` block supplies the default `button.text` label and `start_parameter`. Telegram caps answers at 50 results.

