---
title: "IGramstaxBuildPlan"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IGramstaxBuildPlan](./gramstax.igramstaxbuildplan.md)

## IGramstaxBuildPlan type

Resolved `gramstax build --dry-run` plan printed without writing files.

**Signature:**

```typescript
type IGramstaxBuildPlan = {
    pagesDir: string;
    outDir: string;
    targets: string[];
    deploy: string;
    deploySource: IGramstaxPlanSource;
    adapter: string;
    adapterPath: string;
    adapterSource: IGramstaxPlanSource | `flag`;
    name: string;
    nameSource: IGramstaxPlanSource;
    url: string;
    urlSource: IGramstaxPlanSource;
};
```
**References:** [IGramstaxPlanSource](./gramstax.igramstaxplansource.md)

## Remarks

Built in `GramstaxBuild.run` from the loaded `IGramstaxConfig` plus the `--target` flag, then rendered by `GramstaxBuild._printPlan`. Every value field carries a `*Source` provenance sibling.

