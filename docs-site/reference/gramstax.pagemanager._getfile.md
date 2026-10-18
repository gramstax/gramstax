

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [PageManager](./gramstax.pagemanager.md) &gt; [\_getFile](./gramstax.pagemanager._getfile.md)

## PageManager.\_getFile() method

Extract a page class from a module's exports.

**Signature:**

```typescript
static _getFile(mod: Record<string, unknown>, path: string, positionModule?: number): typeof Ctx;
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

mod


</td><td>

Record&lt;string, unknown&gt;


</td><td>

The module object containing exports.


</td></tr>
<tr><td>

path


</td><td>

string


</td><td>

Path to the file (used in error messages).


</td></tr>
<tr><td>

positionModule


</td><td>

number


</td><td>

_(Optional)_ Index of the exported class. Defaults to `0`.


</td></tr>
</tbody></table>

**Returns:**

typeof [Ctx](./gramstax.ctx.md)

The page class at the specified position.

## Exceptions

Error if file has no exports at the specified position.

## Example


```typescript
const mod = await import("./pages/start.ts");
const StartPage = PageManager._getFile(mod, "./pages/start.ts", 0);
```

