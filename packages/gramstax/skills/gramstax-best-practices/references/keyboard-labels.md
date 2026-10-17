# keyboard-labels

Define shared labels once in `kbl`, compose variants, keep them short and action-led.

## Why

Literal labels scattered across pages drift (`Confirm` vs `Confirm!` vs `✅ Confirm`) and every wording change becomes a hunt. Composites express intent once; pages reference, never retype.

## Incorrect

```typescript
// literals retyped per page — wording drifts silently
await ctx.renderText({keyboard: ctx.inlineKeyboardT([{text: `Confirm`}])})
// another page:
await ctx.renderText({keyboard: ctx.inlineKeyboardT([{text: `Confirm!`}])})
```

## Correct

```typescript
class KeyboardGLabel extends LabelGKeyboard {
  static confirm = {en: `✅ Confirm`, id: `✅ Konfirmasi`}
  static cancelHome = {en: `❌ Cancel | 🏠 Home`, id: `❌ Batal | 🏠 Beranda`}
}
```

## Notes

- Lead with a relevant emoji, keep labels short and action-oriented.
- Define base properties before derived ones so runtime resolution succeeds.
- `_reverse`/`_reverseObj` flip comma-separated order (`Back, Next` → `Next, Back`); escaped commas (`\,`) are preserved.
