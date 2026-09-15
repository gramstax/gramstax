# route-hooks

Wire the four route hooks; `StatusPage` owns not-found and error views.

## Why

Unmatched input and handler throws need designed destinations — otherwise users meet silence and developers meet invisible failures. `hookBeforeRoute` is the single gate for cross-cutting guards (auth, maintenance mode); the rest observe and recover.

## Incorrect

```typescript
// no hooks: unknown callbacks vanish, throws crash the dispatch
export class BotCore extends Gramstax {}
```

## Correct

```typescript
export class BotCore extends Gramstax {
  async hookBeforeRoute(ctx: Ctx) {
    return true // false → `blocked`, handler never runs
  }
  async hookAfterRoute(ctx: Ctx, data) {} // states: matched/no-match/no-handler/blocked/error/timeout
  async hookErrorPage(ctx: Ctx) {
    await new StatusPage(ctx).gerror.show()
  }
  async hookNotFoundPage(ctx: Ctx) {
    await new StatusPage(ctx).gnotFound.show()
  }
}
```

## Notes

- Priority inside `_pageRoutes`: session routes (by `session.method`) → static intents → intent-with-args → `handleFree*` → global `handleFree()` fallback.
- `hookNotFoundPage` fires on `no-match` only when the listener opts in; session routes never auto-clear (see `route-session.md`).
- `hookBeforeStart`/`hookAfterStart` are startup hooks (see `deploy-modes.md`) — different phase, different purpose.
