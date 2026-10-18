---
title: "Gramstax.buildCtxParams()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Gramstax](./gramstax.gramstax.md) &gt; [buildCtxParams](./gramstax.gramstax.buildctxparams.md)

## Gramstax.buildCtxParams() method

Builds the params for one page `Ctx`, plus optional app extras.

**Signature:**

```typescript
buildCtxParams<T extends Record<string, unknown> = Record<string, never>>(ct: ICt, extra?: T): ICtxParams & T;
```

## Parameters

<table><thead><tr><th>

Parameter


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

ct


</td><td>

[ICt](./gramstax.ict.md)


</td><td>

The grammy context for the current update.


</td></tr>
<tr><td>

extra


</td><td>

T


</td><td>

_(Optional)_ Optional app values forwarded into every page `Ctx`.


</td></tr>
</tbody></table>

**Returns:**

[ICtxParams](./gramstax.ictxparams.md) &amp; T

Params for `new Ctx(...)`, shaped as `ICtxParams & T`.

## Remarks

Only assembly point for `createCtx`: per-update `ct` plus the constructor-built `ctxScope` plus a fresh `temp`. App values (e.g. a database handle) ride in `extra` through the params object, but the `Ctx` constructor does NOT attach them — assign each one explicitly in your subclass constructor so every wiring stays visible and easy to troubleshoot. `extra` keys must not be `ct`/`temp` (thrown here).

## Example


```typescript
class MyBot extends Gramstax {
  db = new Db()
  override buildCtxParams<T extends Record<string, unknown> = Record<string, never>>(ct: ICt, _extra?: T): ICtxParams & T & {db: Db} {
    return super.buildCtxParams(ct, {db: this.db}) as ICtxParams & T & {db: Db}
  }
}
class CtxCore extends Ctx {
  declare db: Db
  constructor(params: ICtxParams & {db: Db}) {
    super(params)
    this.db = params.db
  }
}
// inside any page extending CtxCore: this.db — fully typed, zero casts.
```

