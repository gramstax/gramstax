---
title: "IAnswerNoteBlock"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IAnswerNoteBlock](./gramstax.ianswernoteblock.md)

## IAnswerNoteBlock type

Answer-note block for query answers without template content.

**Signature:**

```typescript
type IAnswerNoteBlock = {
    text: string;
};
```

## Remarks

Declared with `<g-answer-note>` blocks. Guest answers carry caller-built results, so the block exists only as fail-fast validation that the template provides the required `AGBaseId` (plus a future content slot). `text` supports the same `{{var|filter}}` interpolation pipeline as poll questions.

This block belongs to `renderGuestAnswer`. `renderWebAppAnswer` accepts it only as a legacy alias and prefers the dedicated `<g-web-app-answer>` block.

## Example


```typescript
const note: IAnswerNoteBlock = {
  text: `Guest answer`
}
```

