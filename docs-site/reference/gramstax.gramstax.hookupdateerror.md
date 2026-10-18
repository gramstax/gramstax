

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Gramstax](./gramstax.gramstax.md) &gt; [hookUpdateError](./gramstax.gramstax.hookupdateerror.md)

## Gramstax.hookUpdateError() method

Hook invoked with a structured error event for every update failure (errors, timeouts, blocked). Use for log sinks / alerting (Sentry, etc.).

**Signature:**

```typescript
/** @virtual */
hookUpdateError?(event: IUpdateErrorEvent): void;
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

event


</td><td>

[IUpdateErrorEvent](./gramstax.iupdateerrorevent.md)


</td><td>

The structured error event. See [IUpdateErrorEvent](./gramstax.iupdateerrorevent.md).


</td></tr>
</tbody></table>

**Returns:**

void

## Remarks

Sibling hooks: `hookSendError` (per-send failures inside `Ctx.render*`, recoverable) and `hookTrace` (every routed update, success included). Routing rule: retry-queue ← `hookSendError`, Sentry ← `hookUpdateError`, dashboard ← `hookTrace`. One incident (e.g. a 403) can fire all three in sequence — do not forward all three to the same alert.

## Example


```typescript
class MyBot extends Gramstax {
  override hookUpdateError(event: IUpdateErrorEvent): void {
    Sentry.captureException(event.error, {tags: {listener: event.listenerName}})
  }
}
```

