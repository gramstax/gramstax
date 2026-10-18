

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IOptFallbackEdit](./gramstax.ioptfallbackedit.md)

## IOptFallbackEdit type

Fallback behavior when an edit operation fails.

**Signature:**

```typescript
type IOptFallbackEdit = `delete-reply` | `reply` | `disable`;
```

## Remarks

- `delete-reply` (default): deletes the original message, then sends a new  one — the result looks like an in-place edit. - `reply`: sends a new message without deleting the original. - `disable`: rethrows the edit error (no fallback).

## Example


```ts
await ctx.edit({fallback: `reply`})
```

