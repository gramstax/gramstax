# route-render-auto

Default to `renderAuto*`; never branch on `this.callbackQuery` yourself.

## Why

Editing the existing message keeps the conversation contextual; replying to a callback query with a new message creates duplicates or orphans. `renderAuto*` implements the edit-vs-send decision from `!!this.callbackQuery` in one place — manual branching duplicates framework logic and drifts when the framework evolves.

## Incorrect

```typescript
async handleCallbackQueryData() {
  // duplicates framework logic; rots on framework updates
  if (this.callbackQuery) {
    await this.renderEdit(kb, da)
  } else {
    await this.render(kb, da)
  }
}
```

## Correct

```typescript
async handleCallbackQueryData() {
  await this.renderAuto(kb, da)
}

// Only when behavior must be forced regardless of update type:
async handleCommandText() {
  await this.render(kb, da) // always a fresh message, even from callbacks
}
```

## Notes

- Family: `renderAuto`, `renderAutoRich`, `renderAutoMedia`, `renderAutoMediaGroup` (each with an edit twin: `render`/`renderEdit`, `renderMedia*`/`renderEditMedia*`).
- `fallbackEdit` controls edit failure: `delete-reply` (default — delete then send, looks like an in-place edit), `reply` (send without deleting), `disable` (rethrow).
- Reserve low-level `reply*` for free-text handlers (`handleSessionFreeText`, `process*`), where a new message is appropriate.
- Reaching for a *different* method than the one that fits — chunking a long message, editing a caption, swapping only a keyboard — is covered in `route-render-api.md`. Do not hand-roll those with `render*` plus manual deletes.
