---
title: "Ctx.buildData()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [buildData](./gramstax.ctx.builddata_1.md)

## Ctx.buildData() method

Creates page routing data configuration with options.

**Signature:**

```typescript
static buildData<C extends (...args: string[]) => Array<string | undefined>>(options: IBuildDataOptions<C> | null): IPageData<Parameters<C>>;
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

options


</td><td>

[IBuildDataOptions](./gramstax.ibuilddataoptions.md)&lt;C&gt; \| null


</td><td>

Configuration options (or null to use defaults). See [IBuildDataOptions](./gramstax.ibuilddataoptions.md) for details.


</td></tr>
</tbody></table>

**Returns:**

[IPageData](./gramstax.ipagedata.md)&lt;Parameters&lt;C&gt;&gt;

The page data configuration object.

