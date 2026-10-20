---
title: "LmdbSchema.version"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbSchema](./lmdb.lmdbschema.md) &gt; [version](./lmdb.lmdbschema.version.md)

## LmdbSchema.version property

Optional shape version for migration transforms.

**Signature:**

```typescript
static version?: number;
```

## Remarks

Declares the row-shape version this schema class models. Transform steps name the version they produce (`schemaVersion`); the runner refuses skewed steps whose target disagrees with this declaration. Unversioned schemas skip the check.

