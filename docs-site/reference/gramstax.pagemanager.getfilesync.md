

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [PageManager](./gramstax.pagemanager.md) &gt; [getFileSync](./gramstax.pagemanager.getfilesync.md)

## PageManager.getFileSync() method

Synchronously load a single page module.

**Signature:**

```typescript
static getFileSync(path?: string, positionModule?: number): typeof Ctx;
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

_(Optional)_ Index of the exported class. Used when file has multiple exports. Defaults to `0`.


</td></tr>
</tbody></table>

**Returns:**

typeof [Ctx](./gramstax.ctx.md)

The first exported page class.

## Exceptions

Error if file has no exports.

## Example


```typescript
const StartPage = PageManager.getFileSync(
  "/path/to/project/src/pages/start.ts"
);
```

