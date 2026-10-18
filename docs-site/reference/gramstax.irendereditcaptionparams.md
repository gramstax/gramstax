

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRenderEditCaptionParams](./gramstax.irendereditcaptionparams.md)

## IRenderEditCaptionParams type

Parameters for `renderEditCaption`.

**Signature:**

```typescript
type IRenderEditCaptionParams = IContent & Omit<IRouteEdit, `mode` | `options`> & {
    mode?: never;
    options?: IOptEditCaption | null;
};
```
**References:** [IContent](./gramstax.icontent.md), [IRouteEdit](./gramstax.irouteedit.md), [IOptEditCaption](./gramstax.iopteditcaption.md)

## Remarks

`params = CONTENT & ROUTE`: the shared template content (`data`, `AGBaseId`) on the forced-edit route (`IRouteEdit`), with `mode` declared `never` — this method always edits, the mode is not a choice. Caption text comes from the `<g-base id>` block via `getGMessage` and is sent via `editMessageCaption`, which rejects a bottom keyboard, so the `keyboard` slot stays inline-only. Fallback modes mirror `renderEdit`: `delete-reply`/`reply` resend the caption as plain text, `disable` throws.

