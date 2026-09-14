# pages-structure

Follow the strict file order; compose pages from Base, consts, Helper, instance `helper = {}`, and `g*` objects; always define `static data`.

## Why

Uniform layout lets any agent (or human) locate routing, rendering, and business logic blind. `static data` is what makes `callbackQueryData()` type-safe — without it, callback wiring is stringly-typed and breaks silently.

## Incorrect

```typescript
export class DepositPage extends PageBase {
  gamount = { show: async () => {} } // handlers missing, data missing
  static template = `...`
  async handleCallbackQueryData() { await this.gamount.show(true) }
}
```

## Correct

```typescript
import {PageBase} from "~/base/page"

class Base {
  static amount = `s1`
}

const DEPOSIT_TIMEOUT = 300_000

class Helper {
  static kb(ctx: DepositPage, bi?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, bi)
  }
}

export class DepositPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gamount.show(true)
  }

  gamount = {
    show: async (edit: boolean) => {},
    process: async (input: string) => {}
  }

  static template = `...`
}
```

## Notes

- Order: imports → `Base` → UPPER consts → `Helper` → Page (`static data` first, handlers, `g*` objects, `static template` last). Skip sections a file does not need — never leave empty class blocks.
- `g<name>` maps from base id: no id → `gdefault`, `id="s1"` → `gs1`, `id="amount"` → `gamount`.
- Instance `helper = {}` is MANDATORY alongside `g*`: every page that defines `g*` objects also defines an instance-level `helper = {}` field holding that page's small closures (keyboard builders, param readers), so `g*` show/process stay one-liner delegations to `this.helper.*` — easy to maintain, readable for humans.
- Instance `helper` vs static `Helper` class: `helper = {}` holds per-page closures capturing `this` (no `ctx` parameter). The static `Helper` class is for shared utilities that take `ctx` explicitly (`Helper.kb(ctx, bi)`). Prefer instance `helper` for page-local logic:

```typescript
helper = {
  kbIndex: () => this.inlineKeyboardT([StartPage], `1`, Base.index)
}
gindex = {
  show: async () => {
    await this.renderAuto(this.helper.kbIndex(), {}, Base.index)
  }
}
```
- Feedback views follow the same pattern (`gsuccess`, `gfailed`, `gerror`, `gwarn`, `ginfo`) and sit after step objects.
