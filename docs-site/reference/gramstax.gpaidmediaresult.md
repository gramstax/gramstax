

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [GPaidMediaResult](./gramstax.gpaidmediaresult.md)

## GPaidMediaResult type

Result of `TemplateManager.getGPaidMedia` for a `<g-paid-media>` block.

**Signature:**

```typescript
type GPaidMediaResult = {
    kind: `paidMedia`;
} & IPaidMediaBlock;
```
**References:** [IPaidMediaBlock](./gramstax.ipaidmediablock.md)

## Remarks

Extends [IPaidMediaBlock](./gramstax.ipaidmediablock.md) with the `paidMedia` kind discriminator.

