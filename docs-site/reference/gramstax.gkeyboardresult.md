

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [GKeyboardResult](./gramstax.gkeyboardresult.md)

## GKeyboardResult type

Result of `TemplateManager.getGKeyboard` for a `<g-keyboard>` block.

**Signature:**

```typescript
type GKeyboardResult = {
    kind: `keyboard`;
    rows: string[];
};
```

## Remarks

`rows` holds the flattened rendered button labels. A missing block yields `{kind: "keyboard", rows: []}`.

