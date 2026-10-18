---
title: "FILTERS"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [FILTERS](./gramstax.filters.md)

## FILTERS variable

Runtime filter table for AOT-generated template code.

**Signature:**

```typescript
FILTERS: Record<string, (value: unknown, ...args: string[]) => unknown>
```

## Remarks

Same table the JIT path closes over (`FILTERS` in generated bodies). Generated code only reads it — never mutate at runtime.

