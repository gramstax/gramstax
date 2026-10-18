---
title: "Gramstax.registerLowPlugin()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Gramstax](./gramstax.gramstax.md) &gt; [registerLowPlugin](./gramstax.gramstax.registerlowplugin.md)

## Gramstax.registerLowPlugin() method

Returns middleware to register as low-level plugins on the bot.

**Signature:**

```typescript
/** @virtual */
registerLowPlugin?(): Array<ICtMiddleware<ICt>>;
```
**Returns:**

Array&lt;[ICtMiddleware](./gramstax.ictmiddleware.md)&lt;[ICt](./gramstax.ict.md)&gt;&gt;

Array of [ICtMiddleware](./gramstax.ictmiddleware.md) values, ready to be spread into `this.bot.use(...result)`.

## Remarks

Override this method in a subclass to inject custom plugin middleware (sessions, i18n, rate limiting, logging, authentication, etc.) into the underlying bot instance.

Each element of the returned array is a [ICtMiddleware](./gramstax.ictmiddleware.md) value (either a `MiddlewareFn` `(ctx, next) => ...` or a `MiddlewareObj` container) that The array elements are passed to `this.bot.use(...)`. It is meant to be spread into `bot.use`, so the order of elements determines the order in which middleware runs — earlier entries wrap later ones (outermost first).

Difference vs. the other lifecycle hooks:

- `hookBeforeStart` — for one-off side effects before the bot starts.  Anything you want to happen exactly once at boot goes there. - `registerLowPlugin` — for middleware that must run on \*\*every update\*\*.  Use this when you need middleware semantics (filter queries,  `next()` chaining, scope-aware registration). - `hookBeforeRoute` / `hookAfterRoute` — for per-update hooks that run  inside the router, after gramstax has already routed to a page.

The base implementation is not provided — subclasses override this to contribute their own plugins. Returning an empty array (or not overriding) installs no plugins, which is the default behavior.

## Example


```typescript
class MyBot extends Gramstax {
  registerLowPlugin() {
    return [
      // 1. Logging middleware (outermost — runs first, exits last)
      async (ctx, next) => {
        this.log?.info?.(`update ${ctx.update.update_id} from ${ctx.from?.id}`)
        await next()
      },
      // 2. Per-chat rate limit (inner)
      async (ctx, next) => {
        // ... check + throttle ...
        await next()
      }
    ]
  }
}
```

