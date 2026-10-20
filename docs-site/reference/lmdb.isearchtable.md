---
title: "ISearchTable"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ISearchTable](./lmdb.isearchtable.md)

## ISearchTable interface

Runtime shape of one attached full-text search table.

**Signature:**

```typescript
interface ISearchTable 
```

## Remarks

One entry per `t.string().search()` column: `column` is the value field, `state` the `{db}:search:{column}` dupSort sub-DB holding term → PK rows.

## Properties

<table><thead><tr><th>

Property


</th><th>

Modifiers


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[column](./lmdb.isearchtable.column.md)


</td><td>


</td><td>

string


</td><td>

Searched value column name.


</td></tr>
<tr><td>

[state](./lmdb.isearchtable.state.md)


</td><td>


</td><td>

LmdbSubState


</td><td>

Backing dupSort sub-DB state (terms to primary keys).


</td></tr>
</tbody></table>

