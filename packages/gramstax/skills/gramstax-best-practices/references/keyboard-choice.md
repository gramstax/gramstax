# keyboard-choice

Inline for actions that edit in place; bottom for persistent text input.

## Why

Inline buttons fire callback queries, so `renderAuto` edits the same message — the conversation stays compact. Bottom buttons send plain text, which re-triggers text routing and litters the chat when the intent was a simple choice.

## Incorrect

```typescript
// a yes/no choice as bottom keyboard — each tap sends a text message,
// needs handleFreeText plumbing, and spams the chat history
const kb = ctx.bottomKeyboard((k) => k.text(`Yes`).text(`No`))
```

## Correct

```typescript
// inline: one tap → callback → in-place edit, no chat spam
const kb = ctx.inlineKeyboardT([YesPage, NoPage], `2`)
await ctx.renderAuto(kb, da)
```

```typescript
// bottom: right for durable input modes (type a city name, pick a persistent action)
const kb = ctx.bottomKeyboard((k) => k.text(`Near me`).text(`Help`))
```

## Notes

- Bottom buttons carry text only (no `callback_data`); validate with `extractBottomLabels` + `resize_keyboard: true`.
- Inline buttons need non-empty `callback_data` and an `answerCallbackQuery` first response.
- Dynamic labels/counts always go through template data into the builders (see `keyboard-reuse.md`).
