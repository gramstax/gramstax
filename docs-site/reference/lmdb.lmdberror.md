---
title: "LmdbError"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbError](./lmdb.lmdberror.md)

## LmdbError class

The single error class thrown by `@gramstax/lmdb`.

**Signature:**

```typescript
declare class LmdbError extends Error 
```
**Extends:** Error

## Remarks

Every public API failure throws this class — inspect `message` to tell failures apart. Plain `Error` is never thrown from this package. Catch this class to handle any error from the package.

## Constructors

<table><thead><tr><th>

Constructor


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[(constructor)(message, options)](./lmdb.lmdberror._constructor_.md)


</td><td>


</td><td>

Constructs a new instance of the `LmdbError` class


</td></tr>
</tbody></table>

