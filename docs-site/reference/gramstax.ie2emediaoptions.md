

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IE2eMediaOptions](./gramstax.ie2emediaoptions.md)

## IE2eMediaOptions type

E2E options for media messages (caption support).

**Signature:**

```typescript
type IE2eMediaOptions = IE2eUpdateOptions & {
    caption?: string;
};
```
**References:** [IE2eUpdateOptions](./gramstax.ie2eupdateoptions.md)

## Remarks

Extends `IE2eUpdateOptions` with an optional caption. Used by `sendPhoto`, `sendVideo`, `sendAudio`, `sendDocument`, `sendAnimation`, and `sendVoice`.

