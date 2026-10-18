---
title: "Ctx.hookBeforeRoute()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [hookBeforeRoute](./gramstax.ctx.hookbeforeroute.md)

## Ctx.hookBeforeRoute() method

Page-level hook before route handler execution.

**Signature:**

```typescript
/** @virtual */
hookBeforeRoute?(): Promise<boolean>;
```
**Returns:**

Promise&lt;boolean&gt;

`true` to continue (handler runs), `false` to abort (handler skipped).

## Remarks

Return `false` to \*\*skip only the target route handler\*\* (e.g. `handleFreeText`, `handleCallbackQueryData`, etc.). The rest of the framework is untouched — you can still call `.renderText()`, `.renderCallbackAnswer()`, and other Ctx methods normally inside this hook before returning `false`.

In other words: returning `false` does NOT freeze the page — it only prevents one specific handler from running.

Useful for: - Per-page cooldown / rate limiting (reply "please wait" then abort) - Precondition checks (reply with redirect page then abort) - Session validity gates

## Example 1


```typescript
// Cooldown — reply then abort the handler
async hookBeforeRoute() {
  const last = await this.cacheSession.get(`${this.from.id}:lastAction`)
  if (last && Date.now() - Number(last) < 2000) {
    await this.renderCallbackAnswer(true, undefined, `cooldown`) // still works
    return false // only skips the target handler
  }
  await this.cacheSession.set(`${this.from.id}:lastAction`, String(Date.now()))
  return true
}
```

## Example 2


```typescript
// KYC gate — send redirect page then abort
async hookBeforeRoute() {
  const profile = await this.db.getUser(this.from.id)
  if (!profile?.kycVerified) {
    await new KycPage(this).showForm() // redirect works
    return false // only skips the guarded handler
  }
  return true
}
```

