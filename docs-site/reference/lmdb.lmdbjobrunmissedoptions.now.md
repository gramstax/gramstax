---
title: "LmdbJobRunMissedOptions.now"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbJobRunMissedOptions](./lmdb.lmdbjobrunmissedoptions.md) &gt; [now](./lmdb.lmdbjobrunmissedoptions.now.md)

## LmdbJobRunMissedOptions.now property

Clock override in epoch ms (default `Date.now()`).

**Signature:**

```typescript
now?: number;
```

## Remarks

Pass this to make the check deterministic in tests instead of reading the clock.

