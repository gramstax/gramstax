# pages-base-classes

Gate a whole page family by extending a base class that defines `hookBeforeRoute` — admin access is the canonical case, and the same technique carries every other family-wide policy.

## Why

A gate copied into each handler is one forgotten page away from being an open door, and there is no list to audit. Putting the gate on a base class makes the family a single auditable unit: the pages under `PageAdminBase` are admin-only by construction, and adding a page cannot silently opt out. The same leverage applies to any policy that must hold for a group of pages.

## The chain

```text
Ctx (gramstax)  →  CtxCore (src/core/ctx.ts)  →  PageBase (src/base/page.ts)
                                                  →  PageAdminBase (src/base/page-admin.ts)
                                                    →  StartAdminPage (src/pages/admin/start.ts)
```

`CtxCore` is where you add app-wide ctx behavior. `PageBase` is the page base — it already carries the shared keyboard statics:

```typescript
// src/base/page.ts
export abstract class PageBase extends CtxCore {
  static kbk = KeyboardGBlock
  static kbl = KeyboardGBlock.label
}
```

Each new base class gets **one** concern. Chain depth beyond `PageAdminBase` is a smell — prefer a composed helper over a four-level hierarchy.

## Access control: `PageAdminBase` + `hookBeforeRoute`

Admin access is the default answer because it is a family-wide gate, not a per-handler check.

```typescript
// src/base/page-admin.ts
import {PageBase} from "./page"

export abstract class PageAdminBase extends PageBase {
  async hookBeforeRoute() {
    // `this` IS the page instance — no ctx param on the page-level hook
    if (await isAdmin(this.from!.id)) return true
    // answer from the template, like every other answer — not a hardcoded string
    await this.renderCallbackAnswer(true, undefined, Base.denied)
    return false // strict `false` is the only value that denies
  }
}
```

```html
<!-- in every gated page's template -->
<g-base id="denied"><g-callback-answer>Forbidden</g-callback-answer></g-base>
```

```typescript
// src/pages/admin/start.ts
import {PageAdminBase} from "~/base/page-admin"

export class StartAdminPage extends PageAdminBase {
  static data = this.buildData()
  async handleCommandText() {
    await this.gdefault.show(false)
  }
}
```

Every route on `StartAdminPage` is now admin-gated — command, callback, session, and free-text alike — because the gate is a method on the class, not a line in a handler.

**The scaffold's stub returns a bare `false`.** That denies correctly but silently: the user gets no reply at all. Render the denial inside the gate before returning `false`, using `renderCallbackAnswer` so the message is a template block like every other answer — localizable via `lang`, and not a hardcoded string living in a base class. That requires a `<g-callback-answer>` block reachable from the page's base id; resolution falls back `callbackAnswer[AGBaseId]` → `callbackAnswer.default`, then `lang` → `default`, so the default base usually suffices.


Gate mechanics that decide whether this works (`core/bot.ts:2766` and 4 sibling sites) are in `route-hooks.md`. The two that bite most:

- Only strict `false` denies — `return await isAdmin(...)` allows when the lookup yields `undefined`. Coerce: `if (!admin) { ...; return false } return true`.
- **`return someCheck(this)` is only safe when the check returns a real boolean.** Delegating the whole return value reads well, and it is what `example/8-newsletter` does:

```typescript
// safe: Array.includes() is spec-guaranteed to return true | false
async hookBeforeRoute() {
  return AdminGuard.isAdmin(this)
}
```

That holds only because `.includes()` cannot yield `undefined`. Swap it for `.find()`, a `Map.get()`, or a DB lookup and the gate silently admits everyone — no error, no log, no failed test. Branch explicitly and return literals when the check is not provably boolean.
- The gate runs before `clearSessionOnce()`, so a denied update does not wipe session state.

## Beyond `hookBeforeRoute`

The base class is the right home for any policy that must hold across a family — one concern per class:

| Concern | Where in the base class | Example |
| --- | --- | --- |
| Access control | `hookBeforeRoute` | admin-only, staff-only, tenant-scoped |
| Cross-cutting telemetry | `hookAfterRoute` | audit-log every admin action, notify on high-value ops |
| Cooldown / rate shape | `hookBeforeRoute` | per-user 2s cooldown on a heavy flow |
| KYC / onboarding gate | `hookBeforeRoute` | redirect unverified users to the KYC form |
| Feature flag | `hookBeforeRoute` | hide unreleased pages behind a flag |
| Shared steps | `g*` objects on the base | a `gsuccess`/`gfailed` pair identical across the family |
| Shared rendering | `helper` methods on the base | one `renderDenied()` or shared keyboard builder |
| Shared defaults | `static data` on the base | declare common callback args once for the family |
| Locale / formatting | typed helpers on the base | family that always renders `lang` + currency |

```typescript
// src/base/page-staff.ts — a second concern, on a second class
export abstract class PageStaffBase extends PageBase {
  async hookAfterRoute() {
    if (this.temp.session?.params?.amount) {
      await this.api.sendMessage(STAFF_CHAT_ID, `staff op: ${this.from!.id}`)
    }
  }
  gdone = {
    show: async () => this.renderAuto(this.helper.kbDone(), {}, Base.done),
    process: async () => {}
  }
}
```

Because `PageStaffBase` and `PageAdminBase` are independent branches off `PageBase`, a class can extend both roles only by composing deliberately — which is the point. Reach for multiple inheritance only when the policies are genuinely orthogonal.

## When NOT to use a base class

- **One page.** A single-page policy belongs in the page, or in `helper`.
- **Unrelated pages.** Two pages sharing a keyboard is not a family — see `keyboard-reuse.md`.
- **A check inside one flow step.** Branching on state mid-handler is not a gate; call a `GuardBase` check there instead (see `guard-guards.md`).
- **Bot-wide policy.** Every route in every family → override `hookBeforeRoute` on `BotCore` (see `route-hooks.md`), not a page base class.

## Base class vs `GuardBase`

They are different tools, and the scaffold ships both:

| | Page base class | `GuardBase` subclass |
| --- | --- | --- |
| Identity | **is** the page (`extends CtxCore`) | wraps a ctx (`new UserGuard(ctx)`) |
| Lifetime | one instance per matched route | one throwaway per call site |
| Owns routing state | yes (`this.data`, `this.temp`, session) | no — `ctx.data` is copied to `this.temp.data` |
| Enforced by | the framework, via `hookBeforeRoute` | nothing; **you** must branch on the result |
| Returns | `true`/`false` | value on success, `null` on failure |
| Use for | a policy that must hold for N pages | a check called explicitly inside one handler |

```typescript
// guard: called explicitly, caller branches on null
export class UserGuard extends GuardBase {
  async _catch(err: unknown, func: string) {
    await new StatusPage(this).gerror.show(func, err)
    return null
  }
  async ensureUsername() {
    try {
      if (!this.from?.username?.length) {
        await new UserNameNotFoundPage(this).gdefault.show()
        return null
      }
      return {status: true}
    } catch (err) {
      return await this._catch(err, `ensureUsername`)
    }
  }
}
```

Rule of thumb: **base class = "every route in this family must satisfy X"**. **Guard = "this one step needs Y checked right now"**.

## Notes

- Base classes live in `src/base/`, one file each (`page.ts`, `page-admin.ts`, `guard.ts`). They are `abstract` — never instantiate one directly.
- Keep them thin. A base class that renders, queries, and branches is a page wearing a hat; move the work into a helper or a repository and leave the policy in the gate.
- Naming: `Page<Role>Base` (`PageAdminBase`, `PageStaffBase`), never `AdminPage` — `Admin*` reads like a concrete page.
- Because the gate is inherited, an admin page that overrides `hookBeforeRoute` **replaces** the family gate. Call `super.hookBeforeRoute()` to compose rather than silently unlock.
- Page-level gates do not increment `metrics.counts.blocked`; add your own counter if the family matters operationally.
- e2e must cover the denial path — a gate that is never exercised in tests is an untested gate. See `e2e-flows.md`.