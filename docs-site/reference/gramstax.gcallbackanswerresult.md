

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [GCallbackAnswerResult](./gramstax.gcallbackanswerresult.md)

## GCallbackAnswerResult type

Result of `TemplateManager.getGCallbackAnswer` for a `<g-callback-answer>` block.

**Signature:**

```typescript
type GCallbackAnswerResult = {
    kind: `callbackAnswer`;
    text: string;
};
```

## Remarks

`text` is the rendered toast text; the getter throws when the block is missing (callback answers always need text).

