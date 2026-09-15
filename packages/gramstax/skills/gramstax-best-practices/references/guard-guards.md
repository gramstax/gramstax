# guard-guards

Put access control and input validation in `GuardBase` subclasses under `src/guards/`, recovering to `StatusPage`.

## Why

Guards scattered through page handlers get bypassed on the next new handler; a guard class centralizes the check and its failure view in one auditable place.

## Incorrect

```typescript
// auth check copy-pasted per handler — one forgotten page is an open door
async handleCallbackQueryData() {
  if (!(await isAdmin(this.from.id))) return
  await this.gdefault.show()
}
```

## Correct

```typescript
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

## Notes

- `GuardBase` wraps a page ctx (`temp.data` passed through) without touching page `data` — guards never own routing state.
- Never swallow: `_catch` renders `StatusPage.gerror` and returns null so callers branch explicitly.
- Guards also own cross-cutting reads like language override (`cacheData` per-user `language_code`).
- Examples: `6-bank-system` (`guards/bank.ts`), `8-newsletter` (`guards/admin.ts` static `isAdmin`).
