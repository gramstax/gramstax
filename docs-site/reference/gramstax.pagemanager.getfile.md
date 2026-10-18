---
title: "PageManager.getFile()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [PageManager](./gramstax.pagemanager.md) &gt; [getFile](./gramstax.pagemanager.getfile.md)

## PageManager.getFile() method

Asynchronously load a single page module with cache busting.

**Signature:**

```typescript
static getFile(path?: string, positionModule?: number): Promise<typeof Ctx>;
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

path


</td><td>

string


</td><td>

_(Optional)_ Path to the page file. Uses default pages directory when omitted.


</td></tr>
<tr><td>

positionModule


</td><td>

number


</td><td>

_(Optional)_ Index of the exported class. Appends timestamp for cache busting. Defaults to `0`.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;typeof [Ctx](./gramstax.ctx.md)&gt;

Promise resolving to the loaded page class.

## Example


```typescript
const StartPage = await PageManager.getFile(
  "/path/to/project/src/pages/start.ts"
);
```

