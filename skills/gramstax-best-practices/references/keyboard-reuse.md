# keyboard-reuse

Centralize a keyboard in `kbk` only when 2+ pages share it; single-use boards stay in the page's instance `helper`.

## Why

Premature centralization couples unrelated pages to one markup — a label tweak for page A silently reshapes page B. Local boards keep blast radius at one page; shared boards earn their place by real reuse.

## Incorrect

```typescript
// one-off keyboard promoted to shared blocks — every page now depends on it
class KeyboardGBlock extends BlockGKeyboard {
  static payNowOnce = (lang?: string) => this._build(`payNowOnce`, lang)
}
```

```typescript
// static Helper class — retired; page-local logic lives in instance `helper = {}`
class Helper {
  static receiptKeyboard(ctx: PayPage) {
    return ctx.inlineKeyboardT([ReceiptPage], `1`)
  }
}
```

## Correct

```typescript
// src/blocks/g-keyboard.ts — shared: used by deposit, withdraw, and transfer
class KeyboardGBlock extends BlockGKeyboard {
  static backHome = (lang?: string) => this._build(`backHome`, lang)
}
```

```typescript
// src/pages/pay.ts — single-use: built in the page's instance helper, dies with it
export class PayPage extends PageBase {
  helper = {
    receiptKeyboard: () => this.inlineKeyboardT([ReceiptPage], `1`)
  }
  gdefault = {
    show: async () => {
      await this.renderText({AGBaseId: Base.default, keyboard: this.helper.receiptKeyboard()})
    },
    process: async () => {}
  }
}
```

## Notes

- Pass template data to builders whenever labels or counts are dynamic.
- `PageBase` exposes the block as `static kbk` and its label helper as `static kbl`, so a page reaches the shared board via `${this.kbk.backHome()}` inside `static template` and `this.kbk.backHome()` in code.
- If three or more pages need the same *page-specific* boards plus a shared gate, that is a base-class signal, not a keyboard one — see `pages-base-classes.md`.
- The instance `helper` (closures capturing `this`, no `ctx` param) replaces the old static `Helper` class for page-local builders. See `pages-structure.md`.