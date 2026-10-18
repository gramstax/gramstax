

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IGramstaxTestDeployOptions](./gramstax.igramstaxtestdeployoptions.md)

## IGramstaxTestDeployOptions type

Test deploy branch of `optionsDeploy`.

**Signature:**

```typescript
type IGramstaxTestDeployOptions = Record<string, never>;
```

## Remarks

Only meaningful when `deploy` is `test`. Accepts no fields — any defined key is rejected as unknown. An empty object counts as an empty branch.

## Example


```typescript
const test: IGramstaxTestDeployOptions = {}
```

