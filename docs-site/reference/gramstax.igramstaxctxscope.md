

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IGramstaxCtxScope](./gramstax.igramstaxctxscope.md)

## IGramstaxCtxScope type

Forwarded `Ctx` fields owned by `Gramstax.ctxScope`.

**Signature:**

```typescript
type IGramstaxCtxScope = Pick<ICtxParams, `cacheSession` | `cacheKeyboard` | `templateManager` | `log` | `mediaRoots` | `onSendError`>;
```
**References:** [ICtxParams](./gramstax.ictxparams.md)

## Remarks

Exactly the `ICtxParams` keys (minus `ct` and `temp`) that `Gramstax` forwards into every page `Ctx`. Add a newly forwarded field here AND in the `Gramstax` constructor scope literal — the `_assertCtxScopeComplete` guard next to `Gramstax.ctxScope` fails `tsc` with the missing field name when this type drifts from `ICtxParams`.

