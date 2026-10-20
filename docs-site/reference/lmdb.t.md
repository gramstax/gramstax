---
title: "t"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [t](./lmdb.t.md)

## t variable

Column type builders.

**Signature:**

```typescript
t: {
    string: {
        (): IColumnBuilder<`string`>;
        <T extends string>(...values: T[]): IColumnBuilder<`string`, `none`, undefined, T>;
    };
    number: {
        (): IColumnBuilder<`number`>;
        <T extends number>(...values: T[]): IColumnBuilder<`number`, `none`, undefined, T>;
    };
    bigint: {
        (): IColumnBuilder<`bigint`>;
        <T extends bigint>(...values: T[]): IColumnBuilder<`bigint`, `none`, undefined, T>;
    };
    enum: {
        (): never;
        <T extends string>(...values: T[]): IColumnBuilder<`string`, `none`, undefined, T>;
        <T extends number>(...values: T[]): IColumnBuilder<`number`, `none`, undefined, T>;
        <T extends bigint>(...values: T[]): IColumnBuilder<`bigint`, `none`, undefined, T>;
    };
    boolean: () => IColumnBuilder<`boolean`>;
    object: <T = Record<string, unknown>, S extends Record<string, IAnyColumnBuilder> | undefined = undefined>(shape?: S) => IColumnBuilder<`object`, `none`, undefined, [S] extends [undefined] ? T : IShapeValueOf<S>>;
    array: <T = unknown, S extends IAnyShapeParam | undefined = undefined>(shape?: S) => IColumnBuilder<`array`, `none`, undefined, [S] extends [undefined] ? T : IShapeElementOf<S>>;
    date: () => IColumnBuilder<`date`>;
    buffer: () => IColumnBuilder<`buffer`>;
    any: () => IColumnBuilder<`any`>;
    map: <K = unknown, V = unknown, S extends {
        key: IAnyColumnBuilder;
        value: IAnyColumnBuilder;
    } | undefined = undefined>(shape?: S) => IColumnBuilder<`map`, `none`, undefined, [S] extends [undefined] ? Map<K, V> : IShapeMapOf<S>>;
    set: <T = unknown, S extends IAnyShapeParam | undefined = undefined>(shape?: S) => IColumnBuilder<`set`, `none`, undefined, [S] extends [undefined] ? Set<T> : Set<IShapeElementOf<S>>>;
}
```

## Remarks

Each builder creates a [IColumnBuilder](./lmdb.icolumnbuilder.md) of the corresponding kind: `t.string()`, `t.number()`, `t.bigint()`, `t.boolean()`, `t.object()`, `t.array()`, `t.date()`, `t.buffer()`. Kind is preserved as a literal type parameter (`ColumnBuilder<`string`>`), which is what drives [IInferSchemaValue](./lmdb.iinferschemavalue.md). `t.object<T>()` / `t.array<T>()` accept an optional element/value type — `t.object<{bio: string}>()` infers the row field as `{bio: string}` and `t.array<string>()` as `string[]`.

