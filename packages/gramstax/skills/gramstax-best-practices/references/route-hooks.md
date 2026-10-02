# route-hooks

There are **two** `hookBeforeRoute` hooks, not one: a bot-level gate (`ctx, data`) that runs before matching, and a page-level gate (`no args`, runs on the instantiated page) that runs after a route matches. Both must pass.

## Why

The two gates sit at different points in the dispatch, so they see different information and fail differently. Bot-level runs before routing, so it cannot know which page matched — it is a global filter. Page-level runs on the already-constructed page, so `this` is the page and it can render a targeted denial. Confusing them produces gates that silently never fire, or denials the user never sees.

## The two gates

| | Bot-level | Page-level |
| --- | --- | --- |
| Declared | `Gramstax.hookBeforeRoute?(ctx, data?)` — `core/bot.ts:1201` | `Ctx.hookBeforeRoute?()` — `core/ctx.ts:2133` |
| Defined on | `src/core/bot.ts` (`BotCore`) | the page class, incl. any base class |
| Signature | `(ctx: ICtx, data?: {listenerName, isEdit}) => Promise<boolean>` | `() => Promise<boolean>` — **no params**, read `this` |
| Runs | once per update, before `_pageRoutes` (`bot.ts:3102`) | per matched route, after `new Page(ctx)` (5 call sites) |
| Knows the page | no | yes (`this` **is** the page) |
| Deny effect | `counts.blocked++`, **early return** — no `hookAfterRoute`, no `hookNotFoundPage`, no `hookErrorPage` | `{state: 'blocked'}` — handler skipped, `hookAfterRoute` fires with `state: 'blocked'`, `counts.blocked` **not** incremented |
| Use for | cross-cutting: auth on every route, maintenance mode, blocklist, ban list | family/page policy: admin-only, KYC gate, cooldown, feature flag |

Precedence is AND-by-short-circuit: the bot gate runs first; if it returns `false` the page gate is never consulted.

## Incorrect

```typescript
// one hook assumed to do both jobs — the page gate is never reached when the
// bot gate denies, and a bare `false` denies with no user-visible response
export class AdminPage extends PageBase {
  async hookBeforeRoute(ctx: Ctx) { // wrong: page-level takes no params
    const admin = await isAdmin(ctx.from.id)
    if (!admin) return false // silent drop: no reply, no log, no error
    return true
  }
}
```

```typescript
// deny-and-explain by returning a value — every non-`false` value ALLOWS
async hookBeforeRoute() {
  return await isAdmin(this.from.id) // `undefined` when not found → route proceeds
}
```

## Correct

```typescript
// page-level: no params, `this` is the page, render the denial yourself
export class AdminPage extends PageAdminBase {
  async hookBeforeRoute() {
    if (await isAdmin(this.from!.id)) return true
    await this.renderCallbackAnswer(true, undefined, Base.denied) // answer, then deny
    return false // strict `false` only — skips the handler, nothing else
  }
}
```

```typescript
// bot-level: cross-cutting, receives ctx + routing metadata
export class BotCore extends Gramstax {
  async hookBeforeRoute(ctx: CtxCore, data?: {listenerName: string; isEdit: boolean}) {
    if (await this.isBanned(ctx.from!.id)) return false // whole update dropped
    return true
  }
}
```

## The page-level gate is uniform

Every one of the 5 dispatch sites (`core/bot.ts:2766`, `2921`, `2956`, `2984`, `3019`) is the same shape — chat-member, dynamic-specific, dynamic, custom-filter, and session routes:

```typescript
const initPage = new Page(ctx)
if ((await initPage.hookBeforeRoute?.()) !== false) {
  await clearSessionOnce()
  await initPage[route.routeName]!()
  await initPage.hookAfterRoute?.()
  return {state: ctx.temp.isAnswer ? `matched` : `no-match`}
}
return {state: `blocked`}
```

Consequences worth knowing before you rely on it:

- **`!== false` is the test.** Omitting the hook (`?.`) allows. `undefined`, `null`, `0`, `""` all **allow**. Only strict `false` denies — so `return await check()` is a bug whenever `check()` can return a falsy non-`false` value. Coerce explicitly.
- **Deny is silent by default.** Nothing renders on `false`. Answer (`renderCallbackAnswer`), render a page, or throw — otherwise the user gets no response at all and the drop is invisible in the UI.
- **The gate runs before `clearSessionOnce()`**, so denying a non-session route leaves the existing session intact — a denied update does not wipe the user's step state.
- **A page-level deny is not counted.** `metrics.counts.blocked` only increments for session-lock contention (`bot.ts:3073`) and bot-level denial (`bot.ts:3104`). Instrument page-level denials yourself.
- **The page instance is throwaway per route.** A new `new Page(ctx)` per matched route, so the gate must not depend on instance state set by a previous route's handler.

## The full hook surface

| Hook | Level | Fires |
| --- | --- | --- |
| `hookBeforeRoute` | bot **and** page | before routing / after match (above) |
| `hookAfterRoute` | bot **and** page | bot: always, with `state`. page: only when the page gate allowed, after the handler |
| `hookErrorPage(ctx, {listenerName, error, isEdit})` | bot | handler threw (non-timeout) |
| `hookNotFoundPage(ctx, {listenerName, isEdit})` | bot | `no-match` only, and only when the listener opts in |
| `hookRateLimited(ctx)` | bot | inbound rate limit tripped; `ctx.render` works, default drops silently |
| `hookKeyGenerator(ctx)` | bot | rate-limit bucket key; **must be synchronous**, defaults to sender id |
| `hookBeforeStart()` / `hookAfterStart()` | bot | startup phase, not routing — see `deploy-modes.md` |
| `hookUpdate` / `hookUpdateError` / `hookTrace` / `hookSendError` | bot | observability; `hookUpdate` is skipped for `error`/`timeout` |

`hookAfterRoute` states: `matched`, `no-match`, `no-handler`, `blocked`, `error`, `timeout`.

## Notes

- Route priority inside `_pageRoutes`: chat-member → static session (by `session.method`) → static intents → intent-with-args → `handleFree*` → global `handleFree()` fallback. `blocked` short-circuits the remaining routes for that listener.
- Prefer a base class over per-page duplication for page-level gates — see `pages-base-classes.md`.
- For a check you call explicitly inside one handler (not a whole-family gate), use `GuardBase` — see `guard-guards.md`.
- Session routes never auto-clear; non-session routes auto-clear once per dispatch (`_clearSessionOnNonSession`). See `route-session.md`.