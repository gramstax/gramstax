

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [buildData](./gramstax.ctx.builddata_2.md)

## Ctx.buildData() method

Creates page routing data configuration without a callback arg.

**Signature:**

```typescript
static buildData(options: IBuildDataOptions | null): IPageData<[]>;
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

[IBuildDataOptions](./gramstax.ibuilddataoptions.md) \| null


</td><td>

Configuration options without `callbackQueryData` (or null to use defaults). See [IBuildDataOptions](./gramstax.ibuilddataoptions.md) for details.


</td></tr>
</tbody></table>

**Returns:**

[IPageData](./gramstax.ipagedata.md)&lt;\[\]&gt;

The page data configuration object.

