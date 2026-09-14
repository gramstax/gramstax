# keyboard-reuse

Centralize a keyboard in `kbk` only when 2+ pages share it; single-use boards stay local.

## Why

Premature centralization couples unrelated pages to one markup — a label tweak for page A silently reshapes page B. Local boards keep blast radius at one page; shared boards earn their place by real reuse.

## Incorrect

```typescript
// one-off keyboard promoted to shared blocks — every page now depends on it
class KeyboardGBlock extends BlockGKeyboard {
  static payNowOnce = (lang?: string) => this._build(`payNowOnce`, lang)
}
```

## Correct

```typescript
// shared: used by deposit, withdraw, and transfer pages
class KeyboardGBlock extends BlockGKeyboard {
  static backHome = (lang?: string) => this._build(`backHome`, lang)
}

// single-use: built in the page Helper, dies with the page
class Helper {
  static kb(ctx: PayPage) {
    return ctx.inlineKeyboardT([ReceiptPage], `1`)
  }
}
```

## Notes

- Pass template data to builders whenever labels or counts are dynamic.
- Shared default keyboards are referenced as `${this.kbk.home()}` inside `static template`.
