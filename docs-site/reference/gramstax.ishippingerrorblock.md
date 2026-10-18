

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IShippingErrorBlock](./gramstax.ishippingerrorblock.md)

## IShippingErrorBlock type

Shipping error block for Telegram payments.

**Signature:**

```typescript
type IShippingErrorBlock = {
    text: string;
};
```

## Remarks

Declared with `<g-shipping-error>` blocks. `text` supports the same `{{var|filter}}` interpolation pipeline as poll questions and becomes the `error_message` shown when the address is rejected (plain text without HTML per the Bot API `answerShippingQuery` limits).

## Example


```typescript
const rejected: IShippingErrorBlock = {
  text: `Di luar zona {{city}}`
}
```

