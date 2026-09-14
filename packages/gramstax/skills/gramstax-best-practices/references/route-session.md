# route-session

Clear session on start, drive multi-step forms with `handleSessionFreeText`, never fetch session manually.

## Why

A stale session routes the next update to the wrong step handler — the classic "bot answers an old question" bug. The framework injects the session into context before the handler runs, so manual `getSession()` calls race the dispatch the framework already performed.

## Incorrect

```typescript
async handleCommandText() {
  await this.gdefault.show(false) // stale session from last visit still active
}

async handleSessionFreeText() {
  const session = await this.getSession() // races framework dispatch
  if (session?.method === `handleSessionFreeText`) { /* ... */ }
}
```

## Correct

```typescript
async handleCommandText() {
  await this.clearSession() // every /start begins from a clean slate
  await this.gdefault.show(false)
}

async handleSessionFreeText() {
  const {step, amount} = Helper.getSessionParams(this) // framework-injected
  if (step === Base.amount) {
    await this.gamount.process(amount)
  }
}
```

## Notes

- `setSessionFreeText(params?)` arms the next free-text step; `process*` validates it.
- Session isolation across users/chats is enforced by the session key — e2e must still prove user A never affects user B (see `e2e-flows.md`).
- Distributed deployments: enable the Redis `sessionLock` so concurrent updates for one user serialize (see `deploy-runtime.md`).
