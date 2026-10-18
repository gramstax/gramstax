

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Gramstax](./gramstax.gramstax.md) &gt; [hookErrorPage](./gramstax.gramstax.hookerrorpage.md)

## Gramstax.hookErrorPage() method

Hook called when a page handler throws an error.

**Signature:**

```typescript
/** @virtual */
hookErrorPage?(ctx: ICtx, data?: {
        listenerName: string;
        error: unknown;
        isEdit: boolean;
    }): Promise<void>;
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

ctx


</td><td>

ICtx


</td><td>

The context instance.


</td></tr>
<tr><td>

data


</td><td>

&#123; listenerName: string; error: unknown; isEdit: boolean; &#125;


</td><td>

_(Optional)_


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;void&gt;

## Remarks

Override this method to handle errors gracefully, e.g., sending an error message to the user or logging to an external service.

A throw from here is contained and logged rather than propagated: this is the last step that can tell a user their request failed, so letting it escape would end the update with nothing sent and nothing recorded.

## Example 1

Simple

```typescript
async hookErrorPage(ctx: Ctx) {
  ...
}
```

## Example 2

Advanced

```typescript
async hookErrorPage(ctx: Ctx, data: NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>) {
  await new StatusPage(ctx).berror.show(`${data.listenerName}:hookErrorPage`, data.error, data.isEdit)
}
```

