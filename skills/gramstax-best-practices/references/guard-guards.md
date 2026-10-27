# guard-guards

Use a **page base class + `hookBeforeRoute`** for a policy that must hold across a page family; use a `GuardBase` subclass for a check one handler calls explicitly.

## Why

Guards scattered through page handlers get bypassed on the next new handler. Both tools centralize the check — but only the base-class gate is *enforced by the framework*. A `GuardBase` call is enforced by the caller branching on the result, so it can be forgotten. Picking the wrong one leaves a policy that looks centralized and is not.

## Pick the tool first

| You want | Use | Why |
| --- | --- | --- |
| every route in a page family gated (admin, staff, KYC, feature flag, cooldown) | **base class + `hookBeforeRoute`** | framework calls it on every matched route; a new page cannot opt out |
| a check inside one handler or one flow step (username present, amount in range) | **`GuardBase` subclass** | it returns a value you branch on; no routing semantics needed |
| every route in the whole bot (ban list, maintenance mode) | **`BotCore.hookBeforeRoute`** | one global gate before routing — see `route-hooks.md` |

Full mechanics, including the `PageAdminBase` pattern and the "beyond `hookBeforeRoute`" cases, are in `pages-base-classes.md`.

## Incorrect

```typescript
// auth check copy-pasted per handler — one forgotten page is an open door
async handleCallbackQueryData() {
  if (!(await isAdmin(this.from.id))) return // silent drop, and easy to omit
  await this.gdefault.show()
}
```

```typescript
// a GuardBase used as a family gate — nothing calls it unless a handler remembers to
export class AdminGuard extends GuardBase {
  async ensureAdmin() { /* ... */ }
}
```

## Correct

```typescript
// family gate: enforced on every matched route of every extending page
// src/base/page-admin.ts
export abstract class PageAdminBase extends PageBase {
  async hookBeforeRoute() {
    if (await isAdmin(this.from!.id)) return true
    await new ForbiddenPage(this).gdefault.show() // visible denial
    return false // strict `false` only
  }
}
```

```typescript
// single-step check: the caller branches on null
// src/guards/admin.ts
import {GuardBase} from "~/base/guard"
import {StatusPage} from "~/pages/status"

export class AdminGuard extends GuardBase {
  async _catch(err: Error | unknown, func: string) {
    await new StatusPage(this).gerror.show(func, err)
    return null
  }

  async ensureAdmin() {
    try {
      return await isAdmin(this.from!.id)
    } catch (err) {
      return await this._catch(err, `ensureAdmin`)
    }
  }
}
```

```typescript
// bot-wide gate: one check, before routing, for every route
// src/core/bot.ts
export class BotCore extends Gramstax {
  async hookBeforeRoute(ctx: CtxCore) {
    const result = await new UserGuard(ctx).ensureUsername()
    return result !== null // `!== null`, so `undefined` does not fail open
  }
}
```

## Notes

- `GuardBase` is project code from `src/base/guard.ts`, not an export of `gramstax`. It wraps a page ctx (`temp.data` passed through) without touching page `data` — guards never own routing state.
- Never swallow: `_catch` renders `StatusPage.gerror` and returns `null` so callers branch explicitly.
- Branch on `!== null`, never on truthiness — a guard that returns `undefined` on a lookup miss must not read as "denied" or "allowed" by accident.
- Guards also own cross-cutting reads like language override (`cacheData` per-user `language_code`).
- A guard that throws inside the family gate propagates to `hookErrorPage`; a guard that returns `null` and is ignored denies nothing. Pick one deliberately.
- Examples: `6-bank-system` (`guards/bank.ts`), `8-newsletter` (`guards/admin.ts` static `isAdmin`).