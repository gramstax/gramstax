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

export class DepositPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gamount.show(true)
  }

  helper = {
    buildKeyboard: (baseId?: string) => this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  gamount = {
    show: async (edit: boolean) => {},
    process: async (input: string) => {}
  }

  static template = `...`
}
```

## Pick the base class first

The `extends` clause is a policy decision, not boilerplate. The chain is `Ctx → CtxCore → PageBase → PageAdminBase → YourPage`.

| Extend | When |
| --- | --- |
| `CtxCore` | adding app-wide ctx behavior, not a page |
| `PageBase` | an ordinary page — carries the shared `kbk`/`kbl` keyboard statics |
| `PageAdminBase` | an admin-only page — the base defines `hookBeforeRoute` and gates every route |
| your own `Page<Role>Base` | a family with its own policy (staff, tenant, KYC-gated, feature-flagged) |

Admin pages are gated by the base class, not by a check repeated in each handler:

```typescript
// src/pages/admin/start.ts — gated by inheritance, nothing repeated per handler
import {PageAdminBase} from "~/base/page-admin"

export class StartAdminPage extends PageAdminBase {
  static data = this.buildData()
  async handleCommandText() {
    await this.gdefault.show(false)
  }
}
```

Base classes are the right home for any family-wide concern, not only `hookBeforeRoute` — see `pages-base-classes.md` for the full pattern and the cases beyond access control.

## Notes

- Order: imports → `Base` → UPPER consts → Page (`static data` first, handlers, instance `helper = {}`, `g*` objects, `static template` last). Skip sections a file does not need — never leave empty class blocks. The static `Helper` class pattern is retired: page-local logic lives in instance `helper = {}` (no `ctx` parameter, captures `this`).
- A page that overrides `hookBeforeRoute` **replaces** the inherited family gate. Call `super.hookBeforeRoute()` to compose rather than silently unlocking the page.
- `g<name>` maps from base id: no id → `gdefault`, `id="s1"` → `gs1`, `id="amount"` → `gamount`.
- Instance `helper = {}` is MANDATORY alongside `g*`: every page that defines `g*` objects also defines an instance-level `helper = {}` field holding that page's small closures (keyboard builders, param readers), so `g*` show/process stay one-liner delegations to `this.helper.*` — easy to maintain, readable for humans.
- Instance `helper` vs static `Helper` class: `helper = {}` holds per-page closures capturing `this` (no `ctx` parameter). The static `Helper` class is for shared utilities that take `ctx` explicitly (`Helper.buildKeyboard(ctx, baseId)`). Prefer instance `helper` for page-local logic:

```typescript
helper = {
  indexKeyboard: () => this.inlineKeyboardT([StartPage], `1`, Base.index)
}
gindex = {
  show: async () => {
    await this.renderText({AGBaseId: Base.index, keyboard: this.helper.indexKeyboard()})
  }
}
```
- Feedback views follow the same pattern (`gsuccess`, `gfailed`, `gerror`, `gwarn`, `ginfo`) and sit after step objects.
