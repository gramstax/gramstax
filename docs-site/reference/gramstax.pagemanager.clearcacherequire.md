

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [PageManager](./gramstax.pagemanager.md) &gt; [clearCacheRequire](./gramstax.pagemanager.clearcacherequire.md)

## PageManager.clearCacheRequire() method

Clear the require cache for all page modules.

**Signature:**

```typescript
static clearCacheRequire(path?: string): boolean;
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

_(Optional)_ Path to the pages directory. Enables hot-reloading of pages.


</td></tr>
</tbody></table>

**Returns:**

boolean

`true` when cache is cleared.

## Exceptions

Error if directory does not exist.

Error if no CommonJS require cache is available (ESM runtime).

## Remarks

CommonJS-only: entries are deleted from the `require` cache. In ESM runtimes without a `require` cache this throws a descriptive error — use the async [PageManager.getFile()](./gramstax.pagemanager.getfile.md) path instead, which cache-busts via an `?t=` import query.

## Example


```typescript
PageManager.clearCacheRequire();
// Clears cache for all pages in default directory
```

