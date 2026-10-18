# route-render-auto

Default to `mode: 'auto'`; never branch on `this.callbackQuery` yourself.

## Why

Editing the existing message keeps the conversation contextual; replying to a callback query with a new message creates duplicates or orphans. Every send-family `render*` method takes one params object with a `mode` field (default `'auto'`) that implements the edit-vs-send decision from `!!this.callbackQuery` in one place — manual branching duplicates framework logic and drifts when the framework evolves.

## Incorrect

```typescript
async handleCallbackQueryData() {
  // duplicates framework logic; rots on framework updates
  if (this.callbackQuery) {
    await this.renderText({keyboard: this.inlineKeyboardT([StartPage], `1`), mode: `edit`})
  } else {
    await this.renderText({keyboard: this.inlineKeyboardT([StartPage], `1`), mode: `reply`})
  }
}
```

## Correct

```typescript
async handleCallbackQueryData() {
  await this.renderText({keyboard: this.inlineKeyboardT([StartPage], `1`)}) // mode defaults to `auto`
}

// Only when behavior must be forced regardless of update type:
async handleCommandText() {
  await this.renderText({keyboard: this.inlineKeyboardT([StartPage], `1`), mode: `reply`}) // always a fresh message, even from callbacks
}
```

## Notes

- `mode: 'auto'` (the default) edits when the update is a callback query, replies otherwise. `mode: 'reply'` always sends. `mode: 'edit'` always edits. The send-family methods — `renderText`, `renderMedia`/`renderMediaGroup`, and the per-kind wrappers (`renderPhoto`, `renderPhotoGroup`, …) — all take the same field.
- `renderText` is the single text method — there is no rich variant to choose. The compiled `<g-message>` block decides plain vs Telegram Rich HTML at compile time, so the same call serves both; `rich` only shapes the rich payload, and its options live on `richEditOptions`.
- `fallback` (`delete-reply` default | `reply` | `disable`) only matters when `mode` resolves to edit — which is exactly why the type makes it unread on `reply`, chunked and broadcast routes rather than silently ignoring it. The fallback resend reads `fallbackOptions`, not `options`.
- Every render method takes ONE params object; positional arguments are gone. `AGBaseId` keeps its job — it selects which `<g-base>` block to resolve.
- Reserve low-level `reply*` for free-text handlers (`handleSessionFreeText`, `process*`), where a new message is appropriate.
- Reaching for a *different* method than the one that fits — chunking a long message, editing a caption, swapping only a keyboard — is covered in `route-render-api.md`. Do not hand-roll those with `renderText` plus manual deletes.
