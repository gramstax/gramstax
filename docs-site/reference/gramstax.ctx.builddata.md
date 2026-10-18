---
title: "Ctx.buildData()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [buildData](./gramstax.ctx.builddata.md)

## Ctx.buildData() method

Creates page routing data configuration with a callback function.

**Signature:**

```typescript
static buildData<C extends (...args: string[]) => Array<string | undefined>>(callbackQueryData: C): IPageData<Parameters<C>>;
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

callbackQueryData


</td><td>

C


</td><td>

A function that returns arg values as an array.


</td></tr>
</tbody></table>

**Returns:**

[IPageData](./gramstax.ipagedata.md)&lt;Parameters&lt;C&gt;&gt;

The page data configuration object.

