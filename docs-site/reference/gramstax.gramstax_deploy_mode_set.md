

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [GRAMSTAX\_DEPLOY\_MODE\_SET](./gramstax.gramstax_deploy_mode_set.md)

## GRAMSTAX\_DEPLOY\_MODE\_SET variable

O(1) membership view of [GRAMSTAX\_DEPLOY\_MODES](./gramstax.gramstax_deploy_modes.md).

**Signature:**

```typescript
GRAMSTAX_DEPLOY_MODE_SET: ReadonlySet<string>
```

## Remarks

A `Set` lookup instead of `Array.includes`, which is O(n). Widened to `ReadonlySet<string>` because call sites test raw `string` input (an `unknown` config field narrowed by `typeof`, and `params.deploy`); a `ReadonlySet<IDeployMode>` would force an unsound cast at every call site. The `as const` tuple above remains the source of truth for the union.

