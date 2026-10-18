

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [isPathUnderRoots](./gramstax.ctx.ispathunderroots.md)

## Ctx.isPathUnderRoots() method

Check whether a local path sits under one of the jail roots.

**Signature:**

```typescript
static isPathUnderRoots(src: string, roots: readonly string[]): boolean;
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

src


</td><td>

string


</td><td>

Local file path to test.


</td></tr>
<tr><td>

roots


</td><td>

readonly string\[\]


</td><td>

Allowed root directories.


</td></tr>
</tbody></table>

**Returns:**

boolean

`true` when `src` is inside any root.

## Remarks

Both `src` and every root are compared in resolved absolute form (`resolve`); a path equal to a root or nested under it (root + separator prefix) is allowed. Symlinks are NOT dereferenced — `resolve` without `realpath` is purely lexical, so a symlinked escape inside an allowed root is the operator's responsibility (keep roots free of untrusted symlinks or pre-resolve with `realpath` before configuring).

