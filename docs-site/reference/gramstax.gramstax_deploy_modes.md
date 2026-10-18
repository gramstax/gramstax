

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [GRAMSTAX\_DEPLOY\_MODES](./gramstax.gramstax_deploy_modes.md)

## GRAMSTAX\_DEPLOY\_MODES variable

Canonical deploy-mode names.

**Signature:**

```typescript
GRAMSTAX_DEPLOY_MODES: readonly ["polling", "webhook", "serverless", "raw", "test"]
```

## Remarks

Single runtime source for the deploy-mode vocabulary. Lives here rather than in `cli/config` so `core/bot` can validate without importing a CLI module. `IDeployMode` is derived from it and [GRAMSTAX\_DEPLOY\_MODE\_SET](./gramstax.gramstax_deploy_mode_set.md) is built from it, so the literal union and the membership test cannot drift apart.

