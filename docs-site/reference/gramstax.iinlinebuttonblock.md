

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IInlineButtonBlock](./gramstax.iinlinebuttonblock.md)

## IInlineButtonBlock type

Inline-button block for Telegram inline query answers.

**Signature:**

```typescript
type IInlineButtonBlock = {
    text: string;
    startParameter?: string;
};
```

## Remarks

Declared with `<g-inline-button>` blocks. `text` supports the same `{{var|filter}}` interpolation pipeline as poll questions and becomes the `button.text` label; `startParameter` maps the `start-parameter` attribute and follows the Bot API deep-link format (`[A-Za-z0-9_-]`, at most 64 chars).

## Example


```typescript
const button: IInlineButtonBlock = {
  text: `Lihat detail`,
  startParameter: `start=1`
}
```

